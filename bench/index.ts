/**
 * Lazy benchmark matrix.
 *
 * 这一版保留现有小包场景，并新增一个接近 1KB 的大包场景。
 * 目标不是完整协议对比，而是看“局部字段读取”在不同 payload 体量下的冷/热路径表现。
 */
import { performance } from "node:perf_hooks";
import { Builder, ByteBuffer } from "flatbuffers";
import { createRegistry, createLazyPayloadReader, encodePayload } from "@fluxbin/core";
import protobuf from "protobufjs";
import {
  Sink,
  read_bool,
  read_str,
  read_u32,
  seq_reader,
  seq_writer,
  write_bool,
  write_str,
  write_u32
} from "ts-binary";

type BenchResult = {
  coldOpsPerSec?: number;
  encodeOpsPerSec?: number;
  encodedBytes: number;
  label: string;
  warmOpsPerSec: number;
};

type UserPayload = {
  active: boolean;
  city: string;
  id: number;
  name: string;
  scores: number[];
};

type Scenario = {
  payload: UserPayload;
  tag: string;
};

const ITERATIONS = 100_000;
const WARMUP_ITERATIONS = 10_000;

const smallScenario: Scenario = {
  payload: {
    active: true,
    city: "上海",
    id: 77,
    name: "fluxbin",
    scores: [1, 2, 3, 5, 8, 13]
  },
  tag: "small"
};

const largeScenario: Scenario = {
  payload: {
    active: true,
    city: "上海浦东新区世纪大道100号",
    id: 77,
    name: "fluxbin-large-payload-user",
    scores: Array.from({ length: 200 }, (_, index) => index * 3 + 1)
  },
  tag: "large-1kb"
};

function measureOpsPerSecond(iterations: number, fn: () => void): number {
  const startedAt = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    fn();
  }
  const elapsedMs = performance.now() - startedAt;
  return iterations / (elapsedMs / 1000);
}

function warmup(fn: () => void) {
  for (let index = 0; index < WARMUP_ITERATIONS; index += 1) {
    fn();
  }
}

function createFluxBinScenario(scenario: Scenario) {
  const registry = createRegistry();
  const registered = registry.register(4001, {
    active: "bool",
    id: "u32",
    name: "utf8-string",
    profile: {
      city: "utf8-string"
    },
    scores: { scalarArray: "u32" }
  });
  if (!registered.ok) {
    throw new Error(registered.error.message);
  }

  const encoded = encodePayload(
    registered.value.compiledNode,
    {
      active: scenario.payload.active,
      id: scenario.payload.id,
      name: scenario.payload.name,
      profile: {
        city: scenario.payload.city
      },
      scores: scenario.payload.scores
    },
    registry.options
  );
  if (!encoded.ok) {
    throw new Error(encoded.error.message);
  }

  return {
    compiledNode: registered.value.compiledNode,
    encodedBytes: encoded.value,
    registry
  };
}

const proto = `
syntax = "proto3";

message Profile {
  string city = 1;
}

message User {
  uint32 id = 1;
  bool active = 2;
  string name = 3;
  Profile profile = 4;
  repeated uint32 scores = 5;
}
`;
const parsed = protobuf.parse(proto);
const root = parsed.root;
const userMessage = root.lookupType("User");

function createProtobufBytes(payload: UserPayload) {
  return userMessage.encode(
    userMessage.create({
      active: payload.active,
      id: payload.id,
      name: payload.name,
      profile: { city: payload.city },
      scores: payload.scores
    })
  ).finish();
}

function createFlatbuffersUserBuffer(payload: UserPayload): Uint8Array {
  const builder = new Builder(4096);

  const cityOffset = builder.createString(payload.city);
  builder.startObject(1);
  builder.addFieldOffset(0, cityOffset, 0);
  const profileOffset = builder.endObject();

  const nameOffset = builder.createString(payload.name);
  builder.startVector(4, payload.scores.length, 4);
  for (let index = payload.scores.length - 1; index >= 0; index -= 1) {
    const score = payload.scores[index];
    let resolvedScore = 0;
    if (score !== undefined) {
      resolvedScore = score;
    }
    builder.addInt32(resolvedScore);
  }
  const scoresOffset = builder.endVector();

  builder.startObject(5);
  const activeBit = payload.active ? 1 : 0;
  builder.addFieldInt32(0, payload.id, 0);
  builder.addFieldInt8(1, activeBit, 0);
  builder.addFieldOffset(2, nameOffset, 0);
  builder.addFieldOffset(3, profileOffset, 0);
  builder.addFieldOffset(4, scoresOffset, 0);
  const userOffset = builder.endObject();
  builder.finish(userOffset);
  return builder.asUint8Array();
}

function readFlatbuffersUser(buffer: Uint8Array) {
  const bb = new ByteBuffer(buffer);
  const rootOffset = bb.position() + bb.readInt32(bb.position());
  const idOffset = bb.__offset(rootOffset, 4);
  const activeOffset = bb.__offset(rootOffset, 6);
  const profileOffset = bb.__offset(rootOffset, 10);
  const scoresOffset = bb.__offset(rootOffset, 12);

  const id = idOffset === 0 ? 0 : bb.readUint32(rootOffset + idOffset);
  const active = activeOffset === 0 ? false : bb.readInt8(rootOffset + activeOffset) === 1;

  let city = "";
  if (profileOffset !== 0) {
    const profileTable = bb.__indirect(rootOffset + profileOffset);
    const cityFieldOffset = bb.__offset(profileTable, 4);
    if (cityFieldOffset !== 0) {
      city = bb.__string(profileTable + cityFieldOffset) as string;
    }
  }

  let score = 0;
  if (scoresOffset !== 0) {
    const vectorStart = bb.__vector(rootOffset + scoresOffset);
    score = bb.readUint32(vectorStart + 3 * 4);
  }

  return { active, city, id, score };
}

function createTsBinaryBuffer(payload: UserPayload): Uint8Array {
  let sink = Sink(new ArrayBuffer(4096));
  sink = write_u32(sink, payload.id);
  sink = write_bool(sink, payload.active);
  sink = write_str(sink, payload.name);
  sink = write_str(sink, payload.city);
  sink = seq_writer(write_u32)(sink, payload.scores);

  return new Uint8Array(sink.view.buffer.slice(0, sink.pos));
}

function readTsBinaryUser(buffer: Uint8Array) {
  const copied = new Uint8Array(buffer);
  const sink = Sink(copied.buffer);
  const id = read_u32(sink);
  const active = read_bool(sink);
  void read_str(sink);
  const city = read_str(sink);
  const scores = seq_reader(read_u32)(sink);
  return { active, city, id, score: scores[3] ?? 0 };
}

function runFluxBinLazyScenario(scenario: Scenario): BenchResult {
  const fluxbin = createFluxBinScenario(scenario);

  warmup(() => {
    const encoded = encodePayload(
      fluxbin.compiledNode,
      {
        active: scenario.payload.active,
        id: scenario.payload.id,
        name: scenario.payload.name,
        profile: {
          city: scenario.payload.city
        },
        scores: scenario.payload.scores
      },
      fluxbin.registry.options
    );
    if (!encoded.ok) {
      throw new Error(encoded.error.message);
    }

    const reader = createLazyPayloadReader(fluxbin.compiledNode, fluxbin.encodedBytes, fluxbin.registry.options);
    if (reader.kind !== "shape") {
      throw new Error("unexpected root kind");
    }
    const id = reader.get("id");
    const profile = reader.get("profile");
    const scores = reader.get("scores");
    if (!id.ok || !profile.ok || !scores.ok) {
      throw new Error("lazy read failed");
    }
  });

  const encodeOpsPerSec = measureOpsPerSecond(ITERATIONS, () => {
    const encoded = encodePayload(
      fluxbin.compiledNode,
      {
        active: scenario.payload.active,
        id: scenario.payload.id,
        name: scenario.payload.name,
        profile: {
          city: scenario.payload.city
        },
        scores: scenario.payload.scores
      },
      fluxbin.registry.options
    );
    if (!encoded.ok) {
      throw new Error(encoded.error.message);
    }
  });

  const coldOpsPerSec = measureOpsPerSecond(ITERATIONS, () => {
    const reader = createLazyPayloadReader(fluxbin.compiledNode, fluxbin.encodedBytes, fluxbin.registry.options);
    if (reader.kind !== "shape") {
      throw new Error("unexpected root kind");
    }

    const id = reader.get("id");
    if (!id.ok) {
      throw new Error(id.error.message);
    }

    const profile = reader.get("profile");
    if (!profile.ok || typeof profile.value !== "object" || profile.value === null || !("kind" in profile.value) || profile.value.kind !== "shape") {
      throw new Error("profile lazy read failed");
    }

    const city = profile.value.get("city");
    if (!city.ok) {
      throw new Error(city.error.message);
    }

    const scores = reader.get("scores");
    if (!scores.ok || typeof scores.value !== "object" || scores.value === null || !("kind" in scores.value) || scores.value.kind !== "scalar-array") {
      throw new Error("scores lazy read failed");
    }

    const score = scores.value.get(3);
    if (!score.ok) {
      throw new Error(score.error.message);
    }
  });

  const warmReader = createLazyPayloadReader(fluxbin.compiledNode, fluxbin.encodedBytes, fluxbin.registry.options);
  if (warmReader.kind !== "shape") {
    throw new Error("unexpected root kind");
  }

  const warmOpsPerSec = measureOpsPerSecond(ITERATIONS, () => {
    const id = warmReader.get("id");
    if (!id.ok) {
      throw new Error(id.error.message);
    }

    const profile = warmReader.get("profile");
    if (!profile.ok || typeof profile.value !== "object" || profile.value === null || !("kind" in profile.value) || profile.value.kind !== "shape") {
      throw new Error("profile lazy read failed");
    }

    const city = profile.value.get("city");
    if (!city.ok) {
      throw new Error(city.error.message);
    }

    const scores = warmReader.get("scores");
    if (!scores.ok || typeof scores.value !== "object" || scores.value === null || !("kind" in scores.value) || scores.value.kind !== "scalar-array") {
      throw new Error("scores lazy read failed");
    }

    const score = scores.value.get(3);
    if (!score.ok) {
      throw new Error(score.error.message);
    }
  });

  return {
    coldOpsPerSec,
    encodedBytes: fluxbin.encodedBytes.byteLength,
    encodeOpsPerSec,
    label: `FluxBin lazy (${scenario.tag})`,
    warmOpsPerSec
  };
}

function runProtobufScenario(scenario: Scenario): BenchResult {
  const encoded = createProtobufBytes(scenario.payload);

  warmup(() => {
    userMessage.encode(
      userMessage.create({
        active: scenario.payload.active,
        id: scenario.payload.id,
        name: scenario.payload.name,
        profile: { city: scenario.payload.city },
        scores: scenario.payload.scores
      })
    ).finish();

    const decoded = userMessage.decode(encoded) as unknown as {
      id: number;
      profile?: { city?: string };
      scores?: number[];
    };
    void decoded.id;
    void decoded.profile;
    void decoded.scores?.[3];
  });

  const encodeOpsPerSec = measureOpsPerSecond(ITERATIONS, () => {
    userMessage.encode(
      userMessage.create({
        active: scenario.payload.active,
        id: scenario.payload.id,
        name: scenario.payload.name,
        profile: { city: scenario.payload.city },
        scores: scenario.payload.scores
      })
    ).finish();
  });

  const coldOpsPerSec = measureOpsPerSecond(ITERATIONS, () => {
    const decoded = userMessage.decode(encoded) as unknown as {
      id: number;
      profile?: { city?: string };
      scores?: number[];
    };
    void decoded.id;
    void decoded.profile;
    void decoded.scores?.[3];
  });

  const warmDecoded = userMessage.decode(encoded) as unknown as {
    id: number;
    profile?: { city?: string };
    scores?: number[];
  };
  const warmOpsPerSec = measureOpsPerSecond(ITERATIONS, () => {
    void warmDecoded.id;
    void warmDecoded.profile;
    void warmDecoded.scores?.[3];
  });

  return {
    coldOpsPerSec,
    encodedBytes: encoded.byteLength,
    encodeOpsPerSec,
    label: `protobufjs eager (${scenario.tag})`,
    warmOpsPerSec
  };
}

function runFlatbuffersScenario(scenario: Scenario): BenchResult {
  const encoded = createFlatbuffersUserBuffer(scenario.payload);

  warmup(() => {
    createFlatbuffersUserBuffer(scenario.payload);
    readFlatbuffersUser(encoded);
  });

  const encodeOpsPerSec = measureOpsPerSecond(ITERATIONS, () => {
    createFlatbuffersUserBuffer(scenario.payload);
  });

  const coldOpsPerSec = measureOpsPerSecond(ITERATIONS, () => {
    readFlatbuffersUser(encoded);
  });

  const warmDecoded = readFlatbuffersUser(encoded);
  const warmOpsPerSec = measureOpsPerSecond(ITERATIONS, () => {
    void warmDecoded.id;
    void warmDecoded.city;
    void warmDecoded.score;
  });

  return {
    coldOpsPerSec,
    encodedBytes: encoded.byteLength,
    encodeOpsPerSec,
    label: `flatbuffers lazy (${scenario.tag})`,
    warmOpsPerSec
  };
}

function runTsBinaryScenario(scenario: Scenario): BenchResult {
  const encoded = createTsBinaryBuffer(scenario.payload);

  warmup(() => {
    createTsBinaryBuffer(scenario.payload);
    readTsBinaryUser(encoded);
  });

  const encodeOpsPerSec = measureOpsPerSecond(ITERATIONS, () => {
    createTsBinaryBuffer(scenario.payload);
  });

  const coldOpsPerSec = measureOpsPerSecond(ITERATIONS, () => {
    readTsBinaryUser(encoded);
  });

  const warmDecoded = readTsBinaryUser(encoded);
  const warmOpsPerSec = measureOpsPerSecond(ITERATIONS, () => {
    void warmDecoded.id;
    void warmDecoded.city;
    void warmDecoded.score;
  });

  return {
    coldOpsPerSec,
    encodedBytes: encoded.byteLength,
    encodeOpsPerSec,
    label: `ts-binary manual (${scenario.tag})`,
    warmOpsPerSec
  };
}

function printResult(result: BenchResult) {
  console.log(`\n[${result.label}]`);
  console.log(`encoded bytes : ${String(result.encodedBytes)}`);
  if (result.encodeOpsPerSec !== undefined) {
    console.log(`encode ops/s  : ${result.encodeOpsPerSec.toFixed(2)}`);
  }
  if (result.coldOpsPerSec !== undefined) {
    console.log(`cold ops/s    : ${result.coldOpsPerSec.toFixed(2)}`);
  }
  console.log(`warm ops/s    : ${result.warmOpsPerSec.toFixed(2)}`);
}

function main() {
  console.log("Lazy benchmark");
  console.log(`iterations     : ${String(ITERATIONS)}`);
  console.log(`warmup         : ${String(WARMUP_ITERATIONS)}`);
  console.log("note           : capnp-js skipped in this round; current package is low-level runtime and needs codegen-style schema wrappers for a fair comparison.");

  const scenarios = [smallScenario, largeScenario];
  for (const scenario of scenarios) {
    console.log(`\n=== Scenario: ${scenario.tag} ===`);
    const results = [
      runFluxBinLazyScenario(scenario),
      runProtobufScenario(scenario),
      runFlatbuffersScenario(scenario),
      runTsBinaryScenario(scenario)
    ];

    for (const result of results) {
      printResult(result);
    }
  }
}

main();

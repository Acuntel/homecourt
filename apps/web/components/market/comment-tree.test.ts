import { describe, it, expect } from "vitest";

import {
  applyVote,
  insertComment,
  replaceTempWithServer,
  setCommentScore,
  type ThreadComment,
} from "./comment-tree";

function make(over: Partial<ThreadComment>): ThreadComment {
  return {
    id: "x",
    parentId: null,
    userId: "u",
    body: "hello",
    score: 0,
    createdAt: "2026-05-22T00:00:00Z",
    username: "alice",
    displayName: null,
    myVote: 0,
    replies: [],
    ...over,
  };
}

describe("insertComment", () => {
  it("prepends top-level", () => {
    const a = make({ id: "a" });
    const result = insertComment([a], make({ id: "b" }));
    expect(result.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("appends reply under parent", () => {
    const parent = make({ id: "p" });
    const result = insertComment([parent], make({ id: "r", parentId: "p" }));
    expect(result[0]!.replies.map((c) => c.id)).toEqual(["r"]);
  });
});

describe("replaceTempWithServer", () => {
  it("swaps the optimistic row in place", () => {
    const tree = [make({ id: "temp-1", body: "draft" })];
    const server = make({ id: "real-1", body: "draft" });
    const next = replaceTempWithServer(tree, "temp-1", server);
    expect(next[0]!.id).toBe("real-1");
  });

  it("also swaps in replies", () => {
    const parent = make({ id: "p", replies: [make({ id: "temp-2" })] });
    const next = replaceTempWithServer([parent], "temp-2", make({ id: "real-2" }));
    expect(next[0]!.replies[0]!.id).toBe("real-2");
  });
});

describe("applyVote", () => {
  it("upvotes from 0 -> 1 and bumps score by +1", () => {
    const tree = [make({ id: "a", score: 4, myVote: 0 })];
    const next = applyVote(tree, "a", 1);
    expect(next[0]!.myVote).toBe(1);
    expect(next[0]!.score).toBe(5);
  });

  it("clears vote 1 -> 0 and drops score by 1", () => {
    const tree = [make({ id: "a", score: 4, myVote: 1 })];
    const next = applyVote(tree, "a", 0);
    expect(next[0]!.myVote).toBe(0);
    expect(next[0]!.score).toBe(3);
  });
});

describe("setCommentScore", () => {
  it("locks in the canonical server score + my vote", () => {
    const tree = [make({ id: "a", score: 99, myVote: 0 })];
    const next = setCommentScore(tree, "a", 7, 1);
    expect(next[0]!.score).toBe(7);
    expect(next[0]!.myVote).toBe(1);
  });
});

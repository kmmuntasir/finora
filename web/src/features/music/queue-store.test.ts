import { beforeEach, describe, expect, it } from "vitest";
import { useQueue } from "./queue-store";

const song = (id: string) => ({ Id: id, Name: id, MediaType: "Audio" as const });
const ids = () => useQueue.getState().queue.map((entry) => entry.item.Id);

describe("music queue", () => {
  beforeEach(() => useQueue.getState().clear());

  it("plays from a start index and advances", () => {
    useQueue.getState().play([song("a"), song("b"), song("c")], 1);
    expect(useQueue.getState().index).toBe(1);
    useQueue.getState().next();
    expect(useQueue.getState().index).toBe(2);
    useQueue.getState().next();
    expect(useQueue.getState().playing).toBe(false);
  });

  it("repeats all and one", () => {
    useQueue.getState().play([song("a"), song("b")], 1);
    useQueue.getState().cycleRepeat();
    useQueue.getState().next();
    expect(useQueue.getState().index).toBe(0);
    useQueue.getState().cycleRepeat();
    const token = useQueue.getState().restartToken;
    useQueue.getState().next();
    expect(useQueue.getState()).toMatchObject({ index: 0, restartToken: token + 1 });
  });

  it("inserts play-next items after the current one and appends to the queue", () => {
    useQueue.getState().play([song("a"), song("b")]);
    useQueue.getState().playNext([song("x")]);
    useQueue.getState().addToQueue([song("z")]);
    expect(ids()).toEqual(["a", "x", "b", "z"]);
  });

  it("keeps the current entry when reordering and removing", () => {
    useQueue.getState().play([song("a"), song("b"), song("c")], 1);
    useQueue.getState().move(1, 2);
    expect(ids()).toEqual(["a", "c", "b"]);
    expect(useQueue.getState().index).toBe(2);
    useQueue.getState().remove(0);
    expect(useQueue.getState().index).toBe(1);
  });

  it("shuffles around the current song and restores the original order", () => {
    useQueue.getState().play([song("a"), song("b"), song("c"), song("d")], 2);
    useQueue.getState().toggleShuffle();
    expect(useQueue.getState().queue[0]?.item.Id).toBe("c");
    expect([...ids()].sort()).toEqual(["a", "b", "c", "d"]);
    useQueue.getState().toggleShuffle();
    expect(ids()).toEqual(["a", "b", "c", "d"]);
    expect(useQueue.getState().index).toBe(2);
  });

  it("ignores non-audio items", () => {
    useQueue.getState().play([{ Id: "v", MediaType: "Video" }]);
    expect(useQueue.getState().index).toBe(-1);
  });
});

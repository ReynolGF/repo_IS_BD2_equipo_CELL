import type { Task } from "../maintenance-task/models/task";

export const taskSeed: Task[] = [
  {
    id: "1",
    name: "a",
    system: "1",
    line: "1",
    type: "Correctivo",
    severity: "Alta",
    author: "1",
    duration: 10,
    timesExecuted: 2,
  },
  {
    id: "2",
    name: "b",
    system: "2",
    line: "2",
    type: "Predictivo",
    severity: "Baja",
    author: "2",
    duration: 20,
    timesExecuted: 1,
  },
  {
    id: "3",
    name: "c",
    system: "3",
    line: "3",
    type: "Preventivo",
    severity: "Media",
    author: "3",
    duration: 30,
    timesExecuted: 3,
  },
];

#!/usr/bin/node

var Resolver = require("./resolver.js");

var util = require('util');

var context = {
    bla: "BLAAA"
};


/*  Job format
    A jobs list is an object with keys corresponding to the job names.
    The value for each key is a job requirements specification:
    `requires` - Jobs required to be finished before this one can run.
    `optional` - Jobs that, if present, should be run before this one.
    `before` - Jobs that, if present, will only run after this job completes (reverse dependency)
    `notif` - Don't run if task is completed. Implies optional dependency
    `task` - `function (done, next)` to execute. In the function body next("result_name");
 */
var testJobs = {
    task1: {                                                   task: function (done, next) { done("task1"); next(); } },
    task2: { requires: [ "task6" ],                            task: function (done, next) { done("task2"); next(); } },
    task3: { requires: [ "task1", "task2" ],                   task: function (done, next) { done("task3"); next(); } },
    task4: { requires: [ "task3" ],                            task: function (done, next) { done("task4"); next(); } },
    task5: { requires: [ "task4" ],                            task: function (done, next) { done("task5"); next(); } },
    task6: { requires: [ "task1" ],                            task: function (done, next) { done("task6"); next(); } },
    task7: { requires: [ "task6" ], optional: [ "task1" ],     task: function (done, next) { done("task7"); next(); } },
    task8: { before: "task2",                                  task: function (done, next) { done("task8"); next(); } },
    task9: { requires: "task1", notif: "task8",                task: function (done, next) { done("task9"); next(); } }
};

var start = new Date();
var stack = Resolver(testJobs);
var initTime = new Date() - start;

var runs = 100000;
start = new Date();
for (var i = 0; i < runs; i++) {
    stack.run();
}
var runTime = new Date() - start;

console.log("Initialization time: " + initTime + " ms, execution performance: " + (1000 * runs/runTime).toFixed(0) + " runs/second");

// console.log(util.inspect(testJobs, { colors: true, depth: 12 }));
// console.log(util.inspect(stack, { colors: true, depth: 12, showHidden: true }));

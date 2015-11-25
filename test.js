#!/usr/bin/node

var Resolver = require("./resolver.js");

var util = require('util');

var context = {
    bla: "BLAAA"
};
var runs = 10;


/*  Job format
    A jobs list is an array of job descriptors
    The value for each key is a job requirements specification:
    `requires` - Jobs required to be finished before this one can run.
    `optional` - Jobs that, if present, should be run before this one.
    `before` - Jobs that, if present, will only run after this job completes (reverse dependency)
    `notif` - Don't run if task is completed. Implies optional dependency
    `task` - `function (done, next)` to execute. In the function body `done("name", "aux event"); next();`
 */
var testJobs = [
    { name: "task1",                                               task: function (done, next) { done("task1", "test"); next(); } },
    { name: "task2", requires: [ "task6" ],                        task: function (done, next) { done("task2"); next(); } },
    { name: "task3", requires: [ "task1", "task2" ],               task: function (done, next) { done("task3"); next(); } },
    { name: "task4", requires: [ "task3" ],                        task: function (done, next) { done("task4"); next(); } },
    { name: "task5", requires: [ "task4" ],                        task: function (done, next) { done("task5"); next(); } },
    { name: "task6", requires: [ "task1" ],                        task: function (done, next) { done("task6"); next(); } },
    { name: "task7", requires: [ "task6" ], optional: [ "task1" ], task: function (done, next) { done("task7"); next(); } },
    { name: "task8", before: "task2",                              task: function (done, next) { done("task8"); next(); } },
    { name: "task9", requires: "task1", notif: "task8",            task: function (done, next) { done("task9"); next(); } }
];

var start = new Date();
var stack = new Resolver(testJobs);
var initTime = new Date() - start;

stack.debug = true;

start = new Date();
for (var i = 0; i < runs; i++) {
    stack.run(context);
}
var runTime = new Date() - start;

console.log("Initialization time: " + initTime + " ms, execution performance: " + (1000 * runs/runTime).toFixed(0) + " runs/second");

// console.log(util.inspect(testJobs, { colors: true, depth: 12 }));
// console.log(util.inspect(stack.jobs, { colors: true, depth: 12, showHidden: true }));

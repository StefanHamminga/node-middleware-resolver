/* middleware-resolver
Copyright (c) 2015 Stefan Hamminga <stefan@prjct.net>, All rights reserved.

This library is free software; you can redistribute it and/or modify it under
the terms of the GNU Lesser General Public License as published by the Free
Software Foundation; either version 3.0 of the License, or (at your option) any
later version.

This library is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.  See the GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License along
with this library.
*/

var util = require('util');

// Convert an Array to an Object, if not already. Wanna know why? Have a look:
// https://jsperf.com/array-indexof-vs-object-key-vs-object-key-true
function toObject(item) {
    "use strict";
    if (item instanceof Array) {
        let result = {};
        for (let i = 0; i < item.length; i++) {
            result[item[i]] = true;
        }
        return result;
    } else {
        let type = typeof item;
        if (type === "string" || type === "number") {
            let ret = {};
            ret[item] = true;
            return ret;
        } else if (type === "undefined") {
            return {};
        } else {
            return item;
        }
    }
}

/**
 * Middleware resolver - Returns a partly pre-resolved runnable middleware object
 * @param {Object} jobs Object describing jobs, see documentation.
 */
function Resolver(jobs) {
    "use strict";

    var tree = { debug: false, run: run, jobs: new Array(jobs.length) };

    for (let i = 0; i < jobs.length; i++) {
        let job = jobs[i];

        // Fetch the possible provides from the job function bodies
        let provideMatches = job.task.toString().match(/[;{}\s\t ]done[\s]?\([^)]+\)/gm);
        let provides = [];
        if (provideMatches) {
            for (let k = 0; k < provideMatches.length; k++) {
                let match = provideMatches[k].replace(/^.*\(/, "").replace(/\).*$/, "");
                Array.prototype.push.apply(provides, JSON.parse("[" + match + "]"));
            }
        }
        job.provides    = toObject(provides);
        job.requires    = toObject(job.requires);
        job.notif       = toObject(job.notif);
        job.optional    = toObject(job.optional);
        job.before      = toObject(job.before);

        // Provide self
        job.provides[job.name] = true;

        // NotIf implies a specific execution order, thus we add them as optional dependency.
        Object.keys(job.notif).forEach(function (val) {
            job.optional[val] = true;
        });
        // Array.prototype.push.apply(job.optional, job.notif);

        tree.jobs[i] = job;
    }

    for (let i = 0; i < tree.jobs.length; i++) {
        let job = tree.jobs[i];

        // Look if we have reverse dependencies and add them to any found jobs as normal requires.
        for (let before in job.before) {
            for (let k = 0; k < tree.jobs.length; k++) {
                if (tree.jobs[k].provides[before] === true) {
                    tree.jobs[k].requires[job.name] = true;
                }
            }
        }

        // If jobs are present and named as optional they get added to the required list
        for (let optional in job.optional) {
            for (let k = 0; k < tree.jobs.length; k++) {
                if (tree.jobs[k].provides[optional] === true) {
                    job.requires[optional] = true;
                }
            }
        }
    }

    //==========================================================================
    /*  TODO: Figure out why sorting makes execution significantly slower,
        instead of faster. I'm guessing the sorted arrays have a significantly
        worse memory structure. */

    //Sort roughly on dependency amount
    tree.jobs.sort(function (a, b) {
        return Object.keys(a.requires).length - Object.keys(b.requires).length;
    });
    //==========================================================================

    /**
     * Run the initialized jobs, optionally using `context` as an execution context
     * @param  {[Object]} context Content to be applied with `bind`
     */
    function run(context) {
        if (tree.debug) console.log("\x1b[93mRunning new stack.\x1b[0m");
        let has = {};

        // By far the fastest way to clone an array: https://jsperf.com/new-array-vs-splice-vs-slice/113
        let stack = new Array(tree.jobs.length);
        let stackPos = tree.jobs.length;
        while(stackPos--) { stack[stackPos] = tree.jobs[stackPos]; }

        function canRun(job) {
            let can = true;
            for (let item in job.notif) {
                if (has[item] === true) {
                    return false;
                }
            }
            for (let item in job.requires) {
                if (has[item] !== true) {
                    return false;
                }
            }
            return can;
        }

        function doneHandler () {
            for (let i = 0; i < arguments.length; i++) {
                has[arguments[i]] = true;
            }
        }

        function nextHandler () {
            for (let i = 0; i < stack.length; i ++) {
                if (canRun(stack[i])) {
                    let job = stack.splice(i, 1)[0];
                    if (tree.debug) {
                        console.log("Jobs done: \x1b[92m" +
                                    Object.keys(has).join(', ') +
                                    "\x1b[0m. Starting job: \x1b[94m" +
                                    job.name +
                                    "\x1b[0m");
                    }
                    if (context) {
                        (job.task).bind(context)(doneHandler, nextHandler);
                    } else {
                        job.task(doneHandler, nextHandler);
                    }
                    break;
                }
            }
        }

        // Initiate the run
        nextHandler();
    }
    return tree;
}

module.exports = Resolver;

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

// Convert any property to an array, if not already.
function toArray (item) {
    "use strict";
    if (item) {
        if (!(item instanceof Array)) {
            item = [ item ];
        }
    } else {
        return [];
    }
    return item;
}

/**
 * Middleware resolver - Returns a partly pre-resolved runnable middleware object
 * @param {Object} jobs Object describing jobs, see documentation.
 */
function Resolver(jobs) {
    "use strict";

    var tree = { run: run, base: [] };

    Object.defineProperty(tree, "jobs", { value: [] });

    // Task names
    let keys = Object.keys(jobs);

    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let job = jobs[key];
        job.name = key;

        job.requires    = toArray(job.requires);
        job.notif       = toArray(job.notif);
        job.optional    = toArray(job.optional);
        job.before      = toArray(job.before);

        // NotIf implies a specific execution order, thus we add them as optional dependency.
        Array.prototype.push.apply(job.optional, job.notif);

        // Look if we have reverse dependencies and add them to any found jobs as normal requires.
        for (let j = 0; j < job.before.length; j++) {
            let j = jobs[job.before[i]];
            if (j) {
                j.requires = toArray(j.requires);
                j.requires.push(job.name);
            }
        }

        // If jobs are present and named as optional they get added to the required list
        for (let j = 0; j < job.optional.length; j++) {
            let o = job.optional[j];
            if (jobs[o]) {
                job.requires.push(o);
            }
        }

        tree.jobs.push(job);
    }

    // Sort roughly on dependency amount
    tree.jobs.sort(function (a, b) {
        a.requires = toArray(a.requires);
        b.requires = toArray(b.requires);
        return a.requires.length - b.requires.length;
    });

    /**
     * Run the initialized jobs, optionally using `context` as an execution context
     * @param  {[Object]} context Content to be applied with `bind`
     */
    function run(context) {
        let has = {};

        // By far the fastest way to clone an array: https://jsperf.com/new-array-vs-splice-vs-slice/113
        let stack = new Array(tree.jobs.length);
        let stackPos = tree.jobs.length;
        while(stackPos--) { stack[stackPos] = tree.jobs[stackPos]; }

        function canRun(job) {
            return (job.notif.every(function (elem) {
                        return (!(has[elem] === true));
                    }) && job.requires.every(function(elem) {
                        return (has[elem] === true);
                    })
                );
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
                    var func;
                    if (context) {
                        func = (job.task).bind(context);
                    } else {
                        func = job.task;
                    }
                    func(doneHandler, nextHandler);
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

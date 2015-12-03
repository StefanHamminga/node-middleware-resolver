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
var inspect = function (item) { return util.inspect(item, { colors: true, depth: 4, showHidden: false, customInspect: false }); };

// Convert any number of input items to a single Object. Wanna know why? Have a look:
// https://jsperf.com/array-indexof-vs-object-key-vs-object-key-true
function toObject() {
    "use strict";
    let ret = {};

    for (let item of arguments) {
        if (item instanceof Array) {
            for (let i = 0; i < item.length; i++) {
                if (typeof item !== 'undefined') {
                    ret[item[i]] = true;
                }
            }
        } else if (typeof item !== 'undefined') {
            ret[item] = true;
        }
    }
    return ret;
}

module.exports = function (middlewares) {
    "use strict";
    var base = {
        debug: false,
        // rebuild: rebuild,
        add: add,
        remove: remove,
        set: set,
        run: run,
        jobs: {}, /* Flat list of jobs */
        stack: []
    };

    // Recalculate dependency tree
    function rebuild() {
        let allProvides = {};

        // Primary cloning and preparation run.
        for (let name of Object.keys(base.jobs)) {
            let job = base.jobs[name];
            // Fetch the possible provides from the job function bodies
            let provideMatches = job.task.toString().match(/[;{}\s\t ]done[\s]?\([^)]+\)/gm);
            let provides = [ job.name ];
            if (provideMatches) {
                for (let k = 0; k < provideMatches.length; k++) {
                    let match = provideMatches[k].replace(/^.*\(/, "").replace(/\).*$/, "");
                    Array.prototype.push.apply(provides, JSON.parse("[" + match + "]"));
                }
            }
            let requires = toObject(job.requires);

            base.stack.push({
                name:       job.name,
                task:       job.task,
                provides:   toObject(provides),
                requires:   requires,
                notif:      toObject(job.notif),
                optional:   toObject(job.optional),
                before:     toObject(job.before),
                after:      toObject(job.after),
                doneBefore: {}
            });
            for (let n of provides) {
                allProvides[n] = true;
            }
        }

        // Filter out impossible jobs
        for (let i = 0; i < base.stack.length; i++) {
            for (let req in base.stack[i].requires) {
                if (allProvides[req] !== true) {
                    if (base.debug) {
                        console.log("\x1b[91mWarning\x1b[0m: Middleware '" + base.stack[i].name + "' can't ever run, discarding it.");
                    }
                    base.stack.splice(i, 1);
                    i--;
                }
            }
        }

        // Cross reference (reverse) dependencies
        for (let job of base.stack) {
            for (let name in job.optional) {
                for (let other of base.stack) {
                    if (other.provides[name]) {
                        job.requires[name] = true;
                    }
                }
            }
            for (let name in job.before) {
                for (let other of base.stack) {
                    if (other.provides[name]) {
                        other.after[job.name] = true;
                    }
                }
            }
        }

        // Determine execution order
        for (let job of base.stack) {
            for (let req in job.requires) {
                for (let other of base.stack) {
                    if (other.provides[req] === true) {
                        job.doneBefore[other.name] = true;
                    }
                }
            }
            for (let optional in job.optional) {
                for (let other of base.stack) {
                    if (other.provides[optional] === true) {
                        job.doneBefore[other.name] = true;
                    }
                }
            }
            for (let notif in job.notif) {
                for (let other of base.stack) {
                    if (other.provides[notif] === true) {
                        job.doneBefore[other.name] = true;
                    }
                }
            }
            for (let after in job.after) {
                for (let other of base.stack) {
                    if (other.provides[after] === true) {
                        job.doneBefore[other.name] = true;
                    }
                }
            }
        }

        //Sort roughly on dependency amount
        base.stack.sort(function (a, b) {
            if (a.doneBefore[b.name] === true) {
                return 1;
            } else if (b.doneBefore[a.name] === true) {
                return -1;
            }

            let ad = Object.keys(a.requires).length;
            let bd = Object.keys(b.requires).length;

            if (ad === bd) {
                if (a.priority) {
                    if (b.priority) {
                        return b.priority - a.priority;
                    } else {
                        return 0 - a.priority;
                    }
                } else {
                    if (b.priority) {
                        return b.priority;
                    } else {
                        return 0;
                    }
                }
            } else {
                return ad - bd;
            }
        });

    }

    // Replace all jobs by supplied list
    function set(jobs) {
        base.jobs = {};
        add(jobs);
    }

    // Add supplied jobs to the existing set
    function add(jobs) {
        for (let a of arguments) {
            if (a instanceof Array) {
                for (let b of a) {
                    base.jobs[b.name] = b;
                }
            } else if (a.name) {
                base.jobs[a.name] = a;
            }
        }
        rebuild();
    }

    // Delete job with supplied name(s) from set
    function remove(jobnames) {
        function _remove(item) {
            if ((typeof item === 'string') || item.name) {
                let keys = Object.keys(base.jobs);
                for (let i = 0; i < keys.length; i++) {
                    if (keys[i] === item) {
                        delete base.jobs[item];
                    }
                }
            } else if (item instanceof Array) {
                for (let j = 0; j < item.length; j++) {
                    _remove(item[j]);
                }
            }
        }
        for (let i = 0; i < arguments.length; i++) {
            _remove(arguments[i]);
        }
        rebuild();
    }

    // Run the set with the supplied context
    function run(context) {
        if (base.debug) {
            if (context && context.url) {
                console.log("\x1b[93mRunning new stack: " + context.url.href + "\x1b[0m");
            } else {
                console.log("\x1b[93mRunning new stack.\x1b[0m");
            }
            var pad = function (a){return("________"+a).slice(-8);};
            var time = function(){let t=process.hrtime();return(t[0]*1000000+t[1]/1000).toFixed(0); };
            var us = time();
        }
        let ran = {};
        let has = {};

        // By far the fastest way to clone an array: https://jsperf.com/new-array-vs-splice-vs-slice/113
        let stack = new Array(base.stack.length);
        let stackPos = base.stack.length;
        while(stackPos--) { stack[stackPos] = base.stack[stackPos]; }
        // console.log("Running stack: " + inspect(stack));

        function canRun(job) {
            for (let item in job.doneBefore) {
                if (ran[item] !== true) {
                    return false;
                }
            }
            for (let item in job.requires) {
                if (has[item] !== true) {
                    return false;
                }
            }
            // for (let item in job.notif) {
            //     if (has[item] === true) {
            //         return false;
            //     }
            // }
            return true;
        }

        function shouldRun(job) {
            for (let item in job.notif) {
                if (has[item] === true) {
                    return false;
                }
            }
            for (let provide in job.provides) {
                if (has[provide] !== true) {
                    return true;
                }
            }
            return false;
        }

        function doneHandler () {
            for (let item of arguments) {
                has[item] = true;
            }
        }

        function nextHandler () {
            for (let i = 0; i < stack.length; i++) {
                if (canRun(stack[i])) {
                    let job = stack.splice(i, 1)[0];
                    if (base.debug) {
                        console.log(pad(time() - us) + "μs: Ran: \x1b[93m" +
                                    Object.keys(ran).join(', ') +
                                    "\x1b[0m. Next: " + job.name);
                    }
                    ran[job.name] = true;
                    if (shouldRun(job)) {
                        if (base.debug) {
                            console.log("           Done: \x1b[92m" +
                                        Object.keys(has).join(', ') +
                                        "\x1b[0m. Starting: \x1b[94m" +
                                        job.name +
                                        "\x1b[0m");
                        }
                        if (context) {
                            (job.task).bind(context)(doneHandler, nextHandler);
                        } else {
                            job.task(doneHandler, nextHandler);
                        }
                    }
                    i = 0;
                }
            }
        }

        // Initiate the run
        nextHandler();
        if (base.debug) {
            console.log("Remaining stack: " + inspect(stack));
        }
    }

    add(middlewares);

    return base;
};

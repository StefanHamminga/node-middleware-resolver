# middleware-resolver
Dependency (and semi-event) based middleware running.

## Task format
A tasks/jobs list is an array containing task descriptors:

property | description
---|---
`requires` | Jobs required to be finished before this one can run.
`optional` | Jobs that, if present, should be run before this one.
`before` | Jobs that, if present, will only run after this job completes (reverse dependency)
`notif` | Don't run if task is completed. Implies optional dependency
`task` | `function (done, next)` to execute. In the function body next("result_name");

For example:
```javascript
[
    {
        name: "task7",
        requires: [ "task6" ],
        optional: "task1",
        task: function (done, next) {
            // more code

            /*  Emit the task name and, optionally, any auxiliary event /
                dependency that is satisfied. The done function can be used as
                many times as practical, or not at all (eg. a case of failure).
             */
            done("task7");

            // more code
            next(); // Run the next task
            // more code
        }
    }
]

```

## Examples

Take a look at `test.js` in the repository for a simple example.

## Notes & license
This project is available on [GitHub](https://github.com/StefanHamminga/node-middleware-resolver) and [npm](https://www.npmjs.com/package/middleware-resolver).

The project is licensed as [LGPLv3](http://www.gnu.org/licenses/lgpl-3.0.html), the license file is included in the project directory.

Copyright 2015 [Stefan Hamminga](mailto:stefan@prjct.net) - [prjct.net](https://prjct.net)

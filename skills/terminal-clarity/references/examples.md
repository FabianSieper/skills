# Reference answers

These examples establish the expected information density, grouping, alignment,
and teaching quality. Adapt them to the question, user language, terminal width,
and available facts. Do not reproduce the decorative structure mechanically.
All numeric values and fictional code findings below are illustrative.

## 1. Explain a mechanism: cache

User: How does a cache work?

A cache stores a copy of frequently requested data so the next request can skip
slower work.

```text
 REQUEST
    |
    v
 Cache lookup
    |
    +-- HIT  ----------------------------> Response
    |                                        2 ms
    |
    +-- MISS --> Database --> Store copy --> Response
                                             150 ms
```

```text
 SPEED (illustrative)
 Cache hit      |                       2 ms
 Cache miss     ####################  150 ms
```

**Trade-off:** a cached copy can become outdated. Expiration or invalidation
keeps it sufficiently fresh.

Why this works: first establish the purpose, then expose the branching behavior
and its consequence. Do not introduce cache eviction algorithms unless relevant.

## 2. Explain an easily confused concept: concurrency and parallelism

User: What is the difference between concurrency and parallelism?

Concurrency coordinates overlapping tasks. Parallelism executes work at the
same instant.

```text
 Two tasks: A and B                 Time --->

 SEQUENTIAL          Core 1   AAAA AAAA BBBB BBBB

 CONCURRENT          Core 1   AAAA BBBB AAAA BBBB
 (single core)

 PARALLEL            Core 1   AAAA AAAA
                     Core 2   BBBB BBBB
```

| | Concurrent | Parallel |
|---|---|---|
| Tasks overlap in progress | Yes | Yes |
| Execute simultaneously | Not required | Yes |

Why this works: use one time axis and one scenario, rather than comparing
unrelated definitions. Distinguish the single-core example from a universal rule.

## 3. Find the counterintuitive aspect: variable refresh rate

User: Why does G-Sync make the same FPS look smoother?

The frame rate can stay identical while the **time each frame remains visible**
changes.

```text
 GPU: 40 FPS (one frame every 25 ms)
 Fixed monitor: 60 Hz (refresh every 16.7 ms)

 Time (ms)     0             50             100
               |             |              |

 FIXED 60 Hz   |AAAAAAA|BBBB|CCCCCCC|DDDD    |
 Duration         33 ms 17ms   33 ms 17ms

 VARIABLE      |AAAAA|BBBBBB|CCCCC|DDDDDD   |
 Duration         25 ms each
```

Fixed-refresh, synchronized presentation may repeat some frames for longer
than others. Variable refresh can match the frame-ready cadence (within its
supported range). The diagram is schematic; exact timing depends on presentation
mode and frame arrival times.

Why this works: expose the timing mismatch, rather than repeating the product's
marketing definition. State assumptions that change the result.

## 4. Diagnose a performance bottleneck

User: Which endpoint is the slowest? Login 40 ms, products 120 ms, search 800 ms.

**Search is the first investigation target:** 20x slower than login.

```text
 LATENCY (ms)      1 block = 40 ms
 -------------------------------------------------------
 /login            #                       40
 /products         ###                    120
 /search           ####################   800
```

Investigate the search query plan and trace timings before choosing a fix.
The measurements alone do not establish the cause.

Why this works: one common scale, aligned values, immediate takeaway. No invented
SLOs, unsupported severity labels, or redundant paragraphs.

## 5. Explain cause and fix: N+1 queries

User: Why are these database reads so inefficient?

The loop makes one database request per user, instead of loading related data
in bulk.

```text
 BEFORE                         AFTER
 ---------------------------    ---------------------------
 Load users --> DB              Load users + orders
   |                                   |
   +-- User 1 --> DB                   v
   +-- User 2 --> DB                 JOIN --> DB
   +-- ...
   +-- User N --> DB

 Calls: 1 + N                   Calls: 1 (with suitable JOIN)
```

| Users | Before | After |
|---:|---:|---:|
| 10 | 11 | 1 |
| 100 | 101 | 1 |
| 1,000 | 1,001 | 1 |

**Fix:** use an appropriate join or batch fetch. A join is not always preferable
when it would duplicate large amounts of data.

Why this works: show the exact cause, the alternative, and how the cost scales.
Do not promise a particular query count for an unverified ORM configuration.

## 6. Explain a misconception: inflation

User: Why are prices still rising when inflation decreases?

Inflation measures how quickly the price level changes, not the price level
itself.

```text
                       Year 0       Year 1       Year 2
 Price index            100          105          107.10
 Change                   -           +5%           +2%

 Inflation rate                      5% ------> 2%   DOWN
 Price index           100 ------> 105 ----> 107.10   UP
```

| Inflation | Price level |
|---|---|
| Above zero | Rises |
| Zero | Stays constant |
| Below zero | Falls (deflation) |

Why this works: visually separate two quantities often confused. The numbers
are illustrative index values, not current inflation statistics.

## 7. Explain a system: Kubernetes

User: How does Kubernetes work?

Kubernetes continuously works to maintain the desired state of an application.

```text
 YOU DECLARE                     KUBERNETES RECONCILES
 ---------------------------     ---------------------------
 Image:      api:v1              Schedule and start workloads
 Replicas:   3                   Replace failed workloads
                                 Adjust to changed desired state

 EXAMPLE: ONE REPLICA FAILS

                          REPLICAS           READY
 Desired                  [#] [#] [#]        3 / 3
 Failure                  [#] [x] [#]        2 / 3
 Replacement starts       [#] [~] [#]        2 / 3
 Restored                 [#] [#] [#]        3 / 3

 # ready     x failed     ~ starting
```

The controller keeps comparing actual and desired state, and acts on the gap.

Why this works: begin with one mental model and a tangible state transition.
Detailed internals such as API server, scheduler, controllers, and kubelet can
follow when they are needed to answer the user's question.

## 8. Support a decision: database choice

User: Which database should I use for my web application?

For a conventional application with related, persistent business records,
start with PostgreSQL. Choose differently if the dominant access pattern calls
for it.

```text
 DOMINANT NEED                     DEFAULT CANDIDATE
 -------------------------------------------------------
 Persistent relational data        PostgreSQL
 Flexible document model           MongoDB
 Fast key-value access / caching   Redis
```

| Trade-off | PostgreSQL | MongoDB | Redis |
|---|---|---|---|
| Primary model | Relations | Documents | Key-value |
| Typical role | System of record | System of record | Cache / fast state |

These are typical uses, not exclusive capabilities. Choose based on access
patterns, durability, consistency, operations, and cost.

Why this works: the relevant selection criteria are more useful than a catalog
of features or unsupported star ratings.

## 9. Code review: actionable, evidence-based layout

User: Review this hypothetical change.

**One blocking issue:** an authenticated user may read another user's order.

```text
 ACCESS CONTROL
 -------------------------------------------------------
 Request --> Authenticated? --> Load order by ID --> Return
                  OK                     |
                                         +-- missing ownership check
```

| Priority | Location | Finding |
|---|---|---|
| Blocking | orders.ts:42 | Order lookup does not check owner |
| Test gap | orders.test.ts:18 | No cross-user access test |

**Fix:** scope the lookup to the authenticated owner. Verify with a test where
user A requests an order belonging to user B.

Why this works: the diagram reveals where the check is missing. The table ties
findings to actionable evidence. Do not use fictional locations in a real review.

## 10. A simple question should stay simple

User: What does HTTP 404 mean?

**404 Not Found:** the server could not find the requested resource.

Why this works: a panel, chart, or table would add effort without improving
understanding.

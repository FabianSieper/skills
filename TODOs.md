# TODOs
This file contains todo-prompts which are to be executed in the future

1. Do not use waitfortimeout anywhere, but instead wait for specific events, like appearing ui elements.
2. I want not only the documentation to be state-driven, but also the code itself: Each POM is a state in the browser / a page in the browser. Transitions betwen Stages can happen either within a POM or by transforming a pom into another, like by navigating to a different page. Each transition between stages is done via pom methods. The stages between documentation and code should match. Maybe this whole idea is already implemented. If so, ignore, if not, apply
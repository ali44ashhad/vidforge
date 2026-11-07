#!/usr/bin/env python3
"""Wires the background course-generation routes into apps/worker/src/server.ts (safe to run twice)."""
import os, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(root, "apps/worker/src/server.ts")
s = open(p).read()
if "registerCourseRoutes" in s:
    print("already patched:", s.count("registerCourseRoutes"), "occurrences"); sys.exit(0)
imp = 'import { registerCourseRoutes } from "./courseJobs";\n'
anchor = 'import { generateIdeas, generateCourseOutline } from "./services/deepseek";\n'
s = s.replace(anchor, anchor + imp, 1) if anchor in s else imp + s
call = "  registerCourseRoutes(app);\n\n"
for a in ['  /** Course outline for the Academy (DeepSeek).', '  app.post("/course-outline"']:
    if a in s:
        s = s.replace(a, call + a, 1); break
else:
    print("ERROR: could not find the /course-outline route in server.ts — send me the file"); sys.exit(1)
open(p, "w").write(s)
print("patched:", s.count("registerCourseRoutes"), "occurrences (want 2)")

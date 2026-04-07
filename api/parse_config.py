#!/usr/bin/env python3
import yaml, json, sys
cfg = yaml.safe_load(sys.stdin)
print(json.dumps(cfg))

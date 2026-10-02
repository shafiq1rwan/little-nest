---
name: hunyuan3d-lowvram-shape
description: Generate untextured prop shapes through Hunyuan3D-2-LowVRAM's public Gradio API.
---

# Hunyuan3D-2-LowVRAM API

## Clients

`clients/shape.py` takes `--url`, `--image`, `--out`, optional `--seed` and `--octree`. Resolve the current app URL through the root Pinokio skill at runtime.

## Operations

`/shape_generation` takes text, input image, four optional view images, steps, guidance, seed, octree resolution, background removal, chunk count, and random-seed toggle in that order. The client uses shape-only generation with 5 steps and background removal. Result: mesh file, HTML preview, statistics, seed.

## Outputs

An untextured GLB at the requested destination. Flat materials and low-poly cleanup happen separately.

## Notes

Regenerate the client if the public Gradio schema changes. Use a single isolated prop image, without sheet captions or adjacent objects.

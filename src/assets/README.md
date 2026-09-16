# Drop-in assets — the walk into PORT

When a visitor presses **Masuk ke PORT**, the camera walks into the real building. It uses the
photographs in this folder — no code to change, just the right file names.

| File | Used for | Required |
| --- | --- | --- |
| `building.jpg` / `.jpeg` / `.png` / `.webp` | Stage 1: the street front of PORT. The camera moves towards the entrance. | Optional |
| `entrance.jpg` / `.jpeg` / `.png` / `.webp` | Final stage: the lobby. The camera moves to the doorway, which opens into the gallery. Also the poster behind the gate while the film loads. | Supplied |

Restart `npm run dev` (or rebuild) after adding or replacing a file.

## Getting a good result

- **Size matters.** The camera moves in close, so use photos **at least 2400px wide**
  (3000–4000px is ideal), saved as `.webp` or high-quality `.jpg` under ~800 KB. The current
  `entrance.webp` is only 680px wide, so it is kept softly lit and the light takes over early —
  a larger photo of the same view will look much sharper.
- **Landscape, eye level, doorway visible.** Stand back far enough that the door the camera
  should walk through is clearly in frame.
- **Where the camera aims.** The walk heads for a "focus" point, given as fractions of the
  photo's width and height. Defaults: the street front aims at the centre, slightly low
  (`x 0.5, y 0.6`); the lobby aims at its doorway (`x 0.37, y 0.54`). If your photo's door is
  elsewhere, change the numbers in `entranceStages` in `src/content/index.ts`.
- Only use photographs PORT owns or has permission to publish.

To point at a URL instead of a file for the lobby, add to a `.env` file in the project root:

```
VITE_PORT_ENTRANCE=https://example.com/your-lobby-photo.jpg
```

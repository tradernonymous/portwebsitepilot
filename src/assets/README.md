# Drop-in assets

## Photo of the PORT front / entrance

Put a photo of the building here and name it **`entrance`** with any of these extensions:

```
entrance.jpg
entrance.jpeg
entrance.png
entrance.webp
```

That is the whole process — no code to change. It is detected automatically and used in
two places:

- behind the opening screen, blended into the dark under the PORT wordmark
- at the end of the approach sequence, so the flythrough arrives at the real frontage

Notes:

- A **wide landscape** shot works best (roughly 16:9). It is masked with a soft radial
  falloff, so the edges of the photo dissolve rather than ending in a hard rectangle —
  you do not need to crop it precisely.
- Aim for under ~800 KB. Anything larger slows the first paint, and the photo is only
  ever shown softly lit and slightly blurred.
- To revert to the default (the programme banner synced from portipoh.com), just delete
  the file.

If you would rather point at a URL than a file, create a `.env` file in the project root
containing:

```
VITE_PORT_ENTRANCE=https://example.com/your-photo.jpg
```

The `.env` value wins over anything in this folder.

---
name: play
description: "Load and explore MIDI files. Analyze structure, navigate measures, search for notes, and display musical content."
---

# /play — Load & Explore MIDI Files

Use the Mozart MCP tools to load, inspect, and navigate MIDI files.

## Quick Start

```
/play song.mid
```

## Workflow

1. **Load the file** with `load_midi` — provide the path and an optional alias
2. **Inspect** with `midi_info` — see tracks, instruments, tempo, time signature
3. **Browse measures** with `get_measures` — view notes by measure number
4. **Search** with `search_notes` — find notes by pitch, track, or range

## Examples

### Load and summarize
```
load_midi file_path="song.mid" alias="song"
midi_info alias="song"
```

### Show measures 1-8 of track 0
```
get_measures alias="song" start_measure=1 end_measure=8 track=0
```

### Find all C notes in the melody
```
search_notes alias="song" note_name="C" track=0
```

### Show measures around a key change
```
get_measures alias="song" start_measure=33 end_measure=36
```

## Tool Reference

| Tool | Purpose |
|------|---------|
| `load_midi` | Parse a .mid file and load it into memory |
| `midi_info` | Show tempo, time sig, tracks, instruments, pitch ranges |
| `get_measures` | Get notes organized by measure (tempo/time-sig aware) |
| `search_notes` | Search notes by pitch, name, track, or measure range |
| `list_loaded` | Show all loaded MIDI files |
| `unload_midi` | Remove a file from memory |

## Tips

- Use short aliases (e.g. "song", "bass") to make commands readable
- Browse a few measures at a time — large ranges produce a lot of output
- Use `search_notes` to find specific patterns before editing
- Track indices are 0-based — check `midi_info` to see what's on each track

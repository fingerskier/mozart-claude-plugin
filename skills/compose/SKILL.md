---
name: compose
description: "Create and edit MIDI files. Add notes, change tempo and time signature, transpose, quantize, and save."
---

# /compose — Create & Edit MIDI Files

Use the Mozart MCP tools to create MIDI files from scratch or edit existing ones.

## Quick Start

```
/compose new_song.mid
```

## Creating a New MIDI File

1. **Create** with `create_midi` — set name, tempo, time signature
2. **Add tracks** with `add_track` — name them and assign instruments
3. **Add notes** with `add_notes` — specify measure, beat, pitch, duration, velocity
4. **Save** with `save_midi` — write to disk

## Editing an Existing File

1. **Load** with `load_midi`
2. **Browse** with `get_measures` to understand the structure
3. **Edit** — use `add_notes`, `delete_notes`, `transpose`, `quantize`
4. **Change tempo/time sig** with `set_tempo`, `set_time_signature`
5. **Save** with `save_midi`

## Examples

### Create a simple melody
```
create_midi alias="demo" name="Demo Song" bpm=120 file_path="demo.mid"
add_track alias="demo" name="Piano" instrument=0
add_notes alias="demo" track=0 notes=[
  {"measure": 1, "beat": 1, "note_name": "C4", "duration_beats": 1, "velocity": 80},
  {"measure": 1, "beat": 2, "note_name": "E4", "duration_beats": 1, "velocity": 80},
  {"measure": 1, "beat": 3, "note_name": "G4", "duration_beats": 1, "velocity": 80},
  {"measure": 1, "beat": 4, "note_name": "C5", "duration_beats": 1, "velocity": 90}
]
save_midi alias="demo"
```

### Transpose a track up a perfect fifth
```
transpose alias="song" track=0 semitones=7
```

### Quantize to eighth notes
```
quantize alias="song" track=1 grid_beats=0.5
```

### Delete notes in measures 5-8 and rewrite
```
delete_notes alias="song" track=0 measure_start=5 measure_end=8
add_notes alias="song" track=0 notes=[...]
save_midi alias="song"
```

### Change tempo mid-song
```
set_tempo alias="song" bpm=140 at_tick=1920
```

## Tool Reference

| Tool | Purpose |
|------|---------|
| `create_midi` | Create a new empty MIDI file |
| `add_track` | Add a track with name and instrument |
| `set_instrument` | Change a track's instrument |
| `add_notes` | Insert notes at measure/beat positions |
| `delete_notes` | Remove notes from a measure range |
| `transpose` | Shift notes up or down by semitones |
| `quantize` | Snap notes to a rhythmic grid |
| `set_tempo` | Set/change tempo at a tick position |
| `set_time_signature` | Set/change time signature |
| `save_midi` | Write MIDI file to disk |

## General MIDI Instruments (Common)

| # | Instrument | # | Instrument |
|---|-----------|---|-----------|
| 0 | Acoustic Grand Piano | 24 | Nylon Guitar |
| 4 | Electric Piano 1 | 25 | Steel Guitar |
| 6 | Harpsichord | 30 | Distortion Guitar |
| 11 | Vibraphone | 32 | Acoustic Bass |
| 13 | Xylophone | 33 | Electric Bass (finger) |
| 16 | Drawbar Organ | 40 | Violin |
| 19 | Church Organ | 42 | Cello |
| 21 | Accordion | 46 | Orchestral Harp |
| 56 | Trumpet | 73 | Flute |
| 60 | French Horn | 71 | Clarinet |
| 65 | Alto Sax | 68 | Oboe |

## Tips

- Note names follow scientific pitch notation: C4 is middle C
- Beats are 1-based within a measure (beat 1 = downbeat)
- Fractional beats work: beat 1.5 = the "and" of beat 1
- Velocity ranges from 1 (barely audible) to 127 (maximum)
- Always `save_midi` after editing — changes are in-memory until saved
- Use `get_measures` to verify your edits look correct before saving

# mozart-claude-plugin

MIDI plugin for Claude Code — load, analyze, edit, and compose MIDI files with musical intelligence.

## Features

- **Load & parse** MIDI files with full structural awareness
- **Time signature and tempo aware** — understands measures, beats, and tempo changes
- **Navigate by measure** — seek to any measure or phrase, not just byte offsets
- **Search notes** — find notes by pitch, name, track, or measure range
- **Edit in place** — add, delete, transpose, and quantize notes
- **Compose from scratch** — create new MIDI files with tracks, instruments, and notes
- **Save changes** — write edits back to standard MIDI files

## Install

After adding the fingerskier marketplace:

```bash
claude plugin marketplace add fingerskier/claude-plugins
claude plugin install mozart@fingerskier-plugins
```

Or install directly:

```bash
claude mcp add mozart -- npx -y mozart-claude-plugin mcp
```

## Skills

| Skill | Description |
|-------|-------------|
| `/play` | Load and explore MIDI files — analyze structure, browse measures, search notes |
| `/compose` | Create and edit MIDI — add notes, change tempo, transpose, quantize, save |

## MCP Tools

| Tool | Description |
|------|-------------|
| `load_midi` | Parse a MIDI file and load it into memory |
| `midi_info` | Get detailed metadata — tempo, time sig, tracks, instruments, pitch ranges |
| `get_measures` | Get notes organized by measure (time-signature aware) |
| `search_notes` | Search for notes by pitch, name, track, or measure range |
| `add_notes` | Insert notes at measure/beat positions |
| `delete_notes` | Remove notes from a measure range |
| `transpose` | Shift notes up or down by semitones |
| `quantize` | Snap note timing to a rhythmic grid |
| `set_tempo` | Set or change tempo at any point |
| `set_time_signature` | Set or change time signature |
| `add_track` | Add a new track with name and instrument |
| `set_instrument` | Change a track's General MIDI instrument |
| `create_midi` | Create a new empty MIDI file |
| `save_midi` | Write the MIDI file to disk |
| `list_loaded` | Show all loaded files |
| `unload_midi` | Remove a file from memory |

## Example Usage

```
> Load song.mid and show me what's in the first 4 measures

> Create a 12-bar blues in C at 120 BPM with piano and bass

> Transpose the melody up a minor third

> Quantize track 2 to eighth notes

> Show me all the C# notes in the bass track
```

## License

[MIT](./LICENSE)

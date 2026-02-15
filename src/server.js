import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as engine from './midi-engine.js';

export async function startServer() {
  const server = new McpServer({
    name: 'mozart',
    version: '2026.2.15',
  });

  // ── load_midi ────────────────────────────────────────────────────────────
  server.tool(
    'load_midi',
    'Load and parse a MIDI file. Returns summary info including tempo, time signature, tracks, and measure count.',
    {
      file_path: z.string().describe('Path to the MIDI file (.mid/.midi)'),
      alias: z.string().optional().describe('Short alias to reference this file later (defaults to file path)'),
    },
    async ({ file_path, alias }) => {
      const result = await engine.loadMidi(file_path, alias);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── midi_info ────────────────────────────────────────────────────────────
  server.tool(
    'midi_info',
    'Get detailed metadata about a loaded MIDI file: tempo map, time signatures, and per-track info (instrument, note count, pitch range).',
    {
      alias: z.string().describe('Alias of the loaded MIDI file'),
    },
    async ({ alias }) => {
      const result = engine.getMidiInfo(alias);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── get_measures ─────────────────────────────────────────────────────────
  server.tool(
    'get_measures',
    'Get notes organized by measure. Time-signature and tempo aware. Returns note names, beats, velocities, and durations.',
    {
      alias: z.string().describe('Alias of the loaded MIDI file'),
      start_measure: z.number().int().min(1).describe('First measure to retrieve (1-based)'),
      end_measure: z.number().int().min(1).describe('Last measure to retrieve (1-based, inclusive)'),
      track: z.number().int().min(0).optional().describe('Track index to filter (omit for all tracks)'),
    },
    async ({ alias, start_measure, end_measure, track }) => {
      const result = engine.getMeasures(alias, start_measure, end_measure, track);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── search_notes ─────────────────────────────────────────────────────────
  server.tool(
    'search_notes',
    'Search for notes matching criteria: pitch range, note name, track, or measure range. Returns up to 200 matches.',
    {
      alias: z.string().describe('Alias of the loaded MIDI file'),
      note_name: z.string().optional().describe('Filter by pitch class (e.g. "C#", "Bb"). Ignores octave.'),
      pitch_min: z.number().int().min(0).max(127).optional().describe('Minimum MIDI pitch number'),
      pitch_max: z.number().int().min(0).max(127).optional().describe('Maximum MIDI pitch number'),
      track: z.number().int().min(0).optional().describe('Track index to search'),
      measure_start: z.number().int().min(1).optional().describe('Start measure'),
      measure_end: z.number().int().min(1).optional().describe('End measure'),
    },
    async ({ alias, note_name, pitch_min, pitch_max, track, measure_start, measure_end }) => {
      const result = engine.searchNotes(alias, {
        noteName: note_name,
        pitchMin: pitch_min,
        pitchMax: pitch_max,
        trackIndex: track,
        measureStart: measure_start,
        measureEnd: measure_end,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── add_notes ────────────────────────────────────────────────────────────
  server.tool(
    'add_notes',
    'Insert notes into a track at measure/beat positions. Specify each note with name, measure, beat, duration, and velocity.',
    {
      alias: z.string().describe('Alias of the loaded MIDI file'),
      track: z.number().int().min(0).describe('Track index'),
      notes: z.array(z.object({
        measure: z.number().int().min(1).describe('Measure number (1-based)'),
        beat: z.number().min(1).describe('Beat within the measure (1-based, can be fractional)'),
        note_name: z.string().describe('Note name (e.g. "C4", "F#3", "Bb5")'),
        duration_beats: z.number().positive().describe('Duration in beats'),
        velocity: z.number().int().min(1).max(127).optional().describe('Note velocity (1-127, default 80)'),
      })).min(1).describe('Notes to add'),
    },
    async ({ alias, track, notes }) => {
      const mapped = notes.map(n => ({
        measure: n.measure,
        beat: n.beat,
        noteName: n.note_name,
        velocity: n.velocity,
        durationBeats: n.duration_beats,
      }));
      const result = engine.addNotes(alias, track, mapped);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── delete_notes ─────────────────────────────────────────────────────────
  server.tool(
    'delete_notes',
    'Delete notes from a track within a measure range. Optionally filter by pitch range.',
    {
      alias: z.string().describe('Alias of the loaded MIDI file'),
      track: z.number().int().min(0).describe('Track index'),
      measure_start: z.number().int().min(1).describe('First measure of deletion range'),
      measure_end: z.number().int().min(1).describe('Last measure of deletion range'),
      pitch_min: z.number().int().min(0).max(127).optional().describe('Only delete notes at or above this pitch'),
      pitch_max: z.number().int().min(0).max(127).optional().describe('Only delete notes at or below this pitch'),
    },
    async ({ alias, track, measure_start, measure_end, pitch_min, pitch_max }) => {
      const result = engine.deleteNotes(alias, track, measure_start, measure_end, {
        pitchMin: pitch_min,
        pitchMax: pitch_max,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── transpose ────────────────────────────────────────────────────────────
  server.tool(
    'transpose',
    'Transpose notes in a track by a number of semitones. Optionally limit to a measure range.',
    {
      alias: z.string().describe('Alias of the loaded MIDI file'),
      track: z.number().int().min(0).describe('Track index'),
      semitones: z.number().int().describe('Number of semitones to transpose (positive = up, negative = down)'),
      measure_start: z.number().int().min(1).optional().describe('Start measure (omit for entire track)'),
      measure_end: z.number().int().min(1).optional().describe('End measure (omit for entire track)'),
    },
    async ({ alias, track, semitones, measure_start, measure_end }) => {
      const result = engine.transposeNotes(alias, track, semitones, measure_start, measure_end);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── quantize ─────────────────────────────────────────────────────────────
  server.tool(
    'quantize',
    'Snap note start times to a grid. Grid size is in beats (e.g. 0.25 = sixteenth notes, 0.5 = eighth notes, 1 = quarter notes).',
    {
      alias: z.string().describe('Alias of the loaded MIDI file'),
      track: z.number().int().min(0).describe('Track index'),
      grid_beats: z.number().positive().describe('Grid resolution in beats (0.25 = 16th, 0.5 = 8th, 1 = quarter)'),
      measure_start: z.number().int().min(1).optional().describe('Start measure'),
      measure_end: z.number().int().min(1).optional().describe('End measure'),
    },
    async ({ alias, track, grid_beats, measure_start, measure_end }) => {
      const result = engine.quantizeNotes(alias, track, grid_beats, measure_start, measure_end);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── set_tempo ────────────────────────────────────────────────────────────
  server.tool(
    'set_tempo',
    'Set or change the tempo (BPM) at a specific tick position. Use tick 0 for the initial tempo.',
    {
      alias: z.string().describe('Alias of the loaded MIDI file'),
      bpm: z.number().positive().describe('Tempo in beats per minute'),
      at_tick: z.number().int().min(0).optional().describe('Tick position (default 0)'),
    },
    async ({ alias, bpm, at_tick }) => {
      const result = engine.setTempo(alias, bpm, at_tick ?? 0);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── set_time_signature ───────────────────────────────────────────────────
  server.tool(
    'set_time_signature',
    'Set or change the time signature at a specific tick position. Use tick 0 for the initial time signature.',
    {
      alias: z.string().describe('Alias of the loaded MIDI file'),
      numerator: z.number().int().min(1).describe('Beats per measure (e.g. 3, 4, 6)'),
      denominator: z.number().int().min(1).describe('Beat unit (e.g. 4 = quarter, 8 = eighth)'),
      at_tick: z.number().int().min(0).optional().describe('Tick position (default 0)'),
    },
    async ({ alias, numerator, denominator, at_tick }) => {
      const result = engine.setTimeSignature(alias, numerator, denominator, at_tick ?? 0);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── add_track ────────────────────────────────────────────────────────────
  server.tool(
    'add_track',
    'Add a new empty track to the MIDI file.',
    {
      alias: z.string().describe('Alias of the loaded MIDI file'),
      name: z.string().optional().describe('Track name'),
      instrument: z.number().int().min(0).max(127).optional().describe('General MIDI instrument number (0-127)'),
    },
    async ({ alias, name, instrument }) => {
      const result = engine.addTrack(alias, name, instrument);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── set_instrument ───────────────────────────────────────────────────────
  server.tool(
    'set_instrument',
    'Change the instrument (program) on a track. Uses General MIDI numbering (0-127).',
    {
      alias: z.string().describe('Alias of the loaded MIDI file'),
      track: z.number().int().min(0).describe('Track index'),
      instrument: z.number().int().min(0).max(127).describe('General MIDI instrument number'),
    },
    async ({ alias, track, instrument }) => {
      const result = engine.setTrackInstrument(alias, track, instrument);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── create_midi ──────────────────────────────────────────────────────────
  server.tool(
    'create_midi',
    'Create a new empty MIDI file in memory. Set initial tempo, time signature, and name.',
    {
      alias: z.string().describe('Alias for referencing this MIDI'),
      name: z.string().optional().describe('Name for the MIDI file'),
      bpm: z.number().positive().optional().describe('Initial tempo (default 120)'),
      numerator: z.number().int().min(1).optional().describe('Time signature numerator (default 4)'),
      denominator: z.number().int().min(1).optional().describe('Time signature denominator (default 4)'),
      file_path: z.string().optional().describe('Default save path'),
    },
    async ({ alias, name, bpm, numerator, denominator, file_path }) => {
      const result = engine.createMidi(alias, { name, bpm, numerator, denominator, filePath: file_path });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── save_midi ────────────────────────────────────────────────────────────
  server.tool(
    'save_midi',
    'Save the MIDI file to disk. Uses the original path unless a new path is given.',
    {
      alias: z.string().describe('Alias of the MIDI to save'),
      output_path: z.string().optional().describe('Output file path (defaults to original load path)'),
    },
    async ({ alias, output_path }) => {
      const result = await engine.saveMidi(alias, output_path);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── list_loaded ──────────────────────────────────────────────────────────
  server.tool(
    'list_loaded',
    'List all currently loaded MIDI files and their state.',
    {},
    async () => {
      const result = engine.listLoaded();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── unload_midi ──────────────────────────────────────────────────────────
  server.tool(
    'unload_midi',
    'Unload a MIDI file from memory. Warns if there are unsaved changes.',
    {
      alias: z.string().describe('Alias of the MIDI to unload'),
    },
    async ({ alias }) => {
      const result = engine.unloadMidi(alias);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Connect ──────────────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

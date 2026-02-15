import toneMidi from '@tonejs/midi';
const { Midi } = toneMidi;
import MidiWriter from 'midi-writer-js';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * In-memory store of loaded MIDI files keyed by an alias.
 * Each entry: { midi: Midi, filePath: string, dirty: boolean }
 */
const loaded = new Map();

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireLoaded(alias) {
  const entry = loaded.get(alias);
  if (!entry) throw new Error(`No MIDI loaded with alias "${alias}". Use load_midi first.`);
  return entry;
}

/**
 * Return the current tempo at a given tick.
 */
function tempoAtTick(midi, tick) {
  const tempos = midi.header.tempos;
  if (!tempos.length) return 120; // default
  let bpm = tempos[0].bpm;
  for (const t of tempos) {
    if (t.ticks <= tick) bpm = t.bpm;
    else break;
  }
  return bpm;
}

/**
 * Return the current time signature at a given tick.
 */
function timeSigAtTick(midi, tick) {
  const sigs = midi.header.timeSignatures;
  if (!sigs.length) return [4, 4];
  let sig = [sigs[0].timeSignature[0], sigs[0].timeSignature[1]];
  for (const s of sigs) {
    if (s.ticks <= tick) sig = [s.timeSignature[0], s.timeSignature[1]];
    else break;
  }
  return sig;
}

/**
 * Calculate ticks per measure at a given tick position.
 */
function ticksPerMeasure(midi, tick) {
  const ppq = midi.header.ppq;
  const [num, den] = timeSigAtTick(midi, tick);
  // quarter notes per measure = num * (4 / den)
  return ppq * num * (4 / den);
}

/**
 * Convert a measure number (1-based) to a tick range.
 */
function measureToTicks(midi, measure) {
  const ppq = midi.header.ppq;
  let currentTick = 0;
  let currentMeasure = 1;

  // Walk through time signatures to find the correct tick
  while (currentMeasure < measure) {
    const tpm = ticksPerMeasure(midi, currentTick);
    currentTick += tpm;
    currentMeasure++;
  }

  const tpm = ticksPerMeasure(midi, currentTick);
  return { start: currentTick, end: currentTick + tpm };
}

/**
 * Convert ticks to a measure + beat position (1-based).
 */
function tickToMeasureBeat(midi, tick) {
  const ppq = midi.header.ppq;
  let currentTick = 0;
  let measure = 1;

  while (true) {
    const tpm = ticksPerMeasure(midi, currentTick);
    if (currentTick + tpm > tick) {
      const [num, den] = timeSigAtTick(midi, currentTick);
      const ticksPerBeat = ppq * (4 / den);
      const beatOffset = (tick - currentTick) / ticksPerBeat;
      return { measure, beat: beatOffset + 1 };
    }
    currentTick += tpm;
    measure++;
  }
}

/**
 * Get total number of measures in the MIDI file.
 */
function totalMeasures(midi) {
  // Find the last tick across all tracks
  let lastTick = 0;
  for (const track of midi.tracks) {
    for (const note of track.notes) {
      const endTick = note.ticks + note.durationTicks;
      if (endTick > lastTick) lastTick = endTick;
    }
  }
  if (lastTick === 0) return 0;

  let currentTick = 0;
  let measures = 0;
  while (currentTick < lastTick) {
    const tpm = ticksPerMeasure(midi, currentTick);
    currentTick += tpm;
    measures++;
  }
  return measures;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNoteName(midiNum) {
  const octave = Math.floor(midiNum / 12) - 1;
  const name = NOTE_NAMES[midiNum % 12];
  return `${name}${octave}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function loadMidi(filePath, alias) {
  const absPath = resolve(filePath);
  const data = await readFile(absPath);
  const midi = new Midi(data);
  alias = alias || absPath;
  loaded.set(alias, { midi, filePath: absPath, dirty: false });

  return {
    alias,
    filePath: absPath,
    name: midi.header.name || '(untitled)',
    format: midi.header.format,
    ppq: midi.header.ppq,
    duration: Math.round(midi.duration * 100) / 100,
    trackCount: midi.tracks.length,
    tempos: midi.header.tempos.map(t => ({ bpm: Math.round(t.bpm * 10) / 10, ticks: t.ticks })),
    timeSignatures: midi.header.timeSignatures.map(ts => ({
      signature: `${ts.timeSignature[0]}/${ts.timeSignature[1]}`,
      ticks: ts.ticks,
    })),
    totalMeasures: totalMeasures(midi),
  };
}

export function getMidiInfo(alias) {
  const { midi, filePath } = requireLoaded(alias);
  const tracks = midi.tracks.map((t, i) => ({
    index: i,
    name: t.name || `Track ${i}`,
    channel: t.channel,
    instrument: t.instrument?.name || 'unknown',
    instrumentNumber: t.instrument?.number,
    noteCount: t.notes.length,
    pitchRange: t.notes.length
      ? { low: midiToNoteName(Math.min(...t.notes.map(n => n.midi))),
          high: midiToNoteName(Math.max(...t.notes.map(n => n.midi))) }
      : null,
  }));

  return {
    alias,
    filePath,
    name: midi.header.name || '(untitled)',
    format: midi.header.format,
    ppq: midi.header.ppq,
    duration: Math.round(midi.duration * 100) / 100,
    totalMeasures: totalMeasures(midi),
    tempos: midi.header.tempos.map(t => ({
      bpm: Math.round(t.bpm * 10) / 10,
      ticks: t.ticks,
      time: Math.round(t.time * 100) / 100,
    })),
    timeSignatures: midi.header.timeSignatures.map(ts => ({
      signature: `${ts.timeSignature[0]}/${ts.timeSignature[1]}`,
      ticks: ts.ticks,
    })),
    tracks,
  };
}

export function getMeasures(alias, startMeasure, endMeasure, trackIndex) {
  const { midi } = requireLoaded(alias);
  const total = totalMeasures(midi);
  if (startMeasure < 1) startMeasure = 1;
  if (endMeasure > total) endMeasure = total;

  const measures = [];
  for (let m = startMeasure; m <= endMeasure; m++) {
    const { start, end } = measureToTicks(midi, m);
    const [num, den] = timeSigAtTick(midi, start);
    const bpm = tempoAtTick(midi, start);

    const measureNotes = [];
    const tracksToScan = trackIndex !== undefined
      ? [midi.tracks[trackIndex]].filter(Boolean)
      : midi.tracks;

    for (const track of tracksToScan) {
      const ti = midi.tracks.indexOf(track);
      for (const note of track.notes) {
        // Note starts within this measure
        if (note.ticks >= start && note.ticks < end) {
          const pos = tickToMeasureBeat(midi, note.ticks);
          measureNotes.push({
            track: ti,
            beat: Math.round(pos.beat * 100) / 100,
            name: midiToNoteName(note.midi),
            midi: note.midi,
            velocity: Math.round(note.velocity * 127),
            durationBeats: Math.round((note.durationTicks / midi.header.ppq) * (den / 4) * 100) / 100,
          });
        }
      }
    }

    measureNotes.sort((a, b) => a.beat - b.beat || a.midi - b.midi);

    measures.push({
      measure: m,
      timeSignature: `${num}/${den}`,
      tempo: Math.round(bpm * 10) / 10,
      notes: measureNotes,
    });
  }

  return { startMeasure, endMeasure, totalMeasures: total, measures };
}

export function searchNotes(alias, opts = {}) {
  const { midi } = requireLoaded(alias);
  const { pitchMin, pitchMax, noteName, trackIndex, measureStart, measureEnd } = opts;
  const results = [];

  const tracksToScan = trackIndex !== undefined
    ? [midi.tracks[trackIndex]].filter(Boolean)
    : midi.tracks;

  for (const track of tracksToScan) {
    const ti = midi.tracks.indexOf(track);
    for (const note of track.notes) {
      // Pitch filter
      if (pitchMin !== undefined && note.midi < pitchMin) continue;
      if (pitchMax !== undefined && note.midi > pitchMax) continue;
      if (noteName && midiToNoteName(note.midi).replace(/\d+/, '') !== noteName.toUpperCase()) continue;

      // Measure filter
      if (measureStart !== undefined || measureEnd !== undefined) {
        const pos = tickToMeasureBeat(midi, note.ticks);
        if (measureStart !== undefined && pos.measure < measureStart) continue;
        if (measureEnd !== undefined && pos.measure > measureEnd) continue;
      }

      const pos = tickToMeasureBeat(midi, note.ticks);
      results.push({
        track: ti,
        measure: pos.measure,
        beat: Math.round(pos.beat * 100) / 100,
        name: midiToNoteName(note.midi),
        midi: note.midi,
        velocity: Math.round(note.velocity * 127),
        durationTicks: note.durationTicks,
      });
    }
  }

  results.sort((a, b) => a.measure - b.measure || a.beat - b.beat || a.midi - b.midi);
  return { count: results.length, notes: results.slice(0, 200) };
}

export function addNotes(alias, trackIndex, notes) {
  const entry = requireLoaded(alias);
  const { midi } = entry;
  const track = midi.tracks[trackIndex];
  if (!track) throw new Error(`Track ${trackIndex} does not exist.`);

  const added = [];
  for (const n of notes) {
    const { measure, beat, noteName: name, velocity, durationBeats } = n;
    // Convert measure/beat to ticks
    const { start: measureStart } = measureToTicks(midi, measure);
    const [, den] = timeSigAtTick(midi, measureStart);
    const ticksPerBeat = midi.header.ppq * (4 / den);
    const ticks = measureStart + Math.round((beat - 1) * ticksPerBeat);
    const durationTicks = Math.round(durationBeats * ticksPerBeat);

    // Parse note name to midi number
    const midiNum = noteNameToMidi(name);
    const vel = (velocity !== undefined ? velocity : 80) / 127;

    track.addNote({
      midi: midiNum,
      ticks,
      durationTicks,
      velocity: vel,
    });

    added.push({ name, midi: midiNum, measure, beat, durationBeats, velocity: velocity || 80 });
  }

  entry.dirty = true;
  return { trackIndex, added, totalNotesInTrack: track.notes.length };
}

export function deleteNotes(alias, trackIndex, measureStart, measureEnd, opts = {}) {
  const entry = requireLoaded(alias);
  const { midi } = entry;
  const track = midi.tracks[trackIndex];
  if (!track) throw new Error(`Track ${trackIndex} does not exist.`);

  const { start } = measureToTicks(midi, measureStart);
  const { end } = measureToTicks(midi, measureEnd);

  const before = track.notes.length;
  const { pitchMin, pitchMax } = opts;

  track.notes = track.notes.filter(note => {
    if (note.ticks < start || note.ticks >= end) return true;
    if (pitchMin !== undefined && note.midi < pitchMin) return true;
    if (pitchMax !== undefined && note.midi > pitchMax) return true;
    return false;
  });

  const removed = before - track.notes.length;
  entry.dirty = true;
  return { trackIndex, removedCount: removed, remainingNotes: track.notes.length };
}

export function setTempo(alias, bpm, atTick = 0) {
  const entry = requireLoaded(alias);
  const { midi } = entry;
  // Remove any existing tempo at the same tick
  midi.header.tempos = midi.header.tempos.filter(t => t.ticks !== atTick);
  midi.header.tempos.push({ ticks: atTick, bpm });
  midi.header.tempos.sort((a, b) => a.ticks - b.ticks);
  entry.dirty = true;
  return { bpm, atTick, allTempos: midi.header.tempos.map(t => ({ bpm: t.bpm, ticks: t.ticks })) };
}

export function setTimeSignature(alias, numerator, denominator, atTick = 0) {
  const entry = requireLoaded(alias);
  const { midi } = entry;
  midi.header.timeSignatures = midi.header.timeSignatures.filter(ts => ts.ticks !== atTick);
  midi.header.timeSignatures.push({ ticks: atTick, timeSignature: [numerator, denominator] });
  midi.header.timeSignatures.sort((a, b) => a.ticks - b.ticks);
  entry.dirty = true;
  return {
    signature: `${numerator}/${denominator}`,
    atTick,
    allSignatures: midi.header.timeSignatures.map(ts => ({
      signature: `${ts.timeSignature[0]}/${ts.timeSignature[1]}`,
      ticks: ts.ticks,
    })),
  };
}

export function addTrack(alias, name, instrument) {
  const entry = requireLoaded(alias);
  const { midi } = entry;
  const track = midi.addTrack();
  track.name = name || `Track ${midi.tracks.length - 1}`;
  if (instrument !== undefined) {
    track.instrument.number = instrument;
  }
  entry.dirty = true;
  return {
    trackIndex: midi.tracks.length - 1,
    name: track.name,
    instrument: track.instrument.name,
  };
}

export function setTrackInstrument(alias, trackIndex, instrument) {
  const entry = requireLoaded(alias);
  const { midi } = entry;
  const track = midi.tracks[trackIndex];
  if (!track) throw new Error(`Track ${trackIndex} does not exist.`);
  track.instrument.number = instrument;
  entry.dirty = true;
  return { trackIndex, instrument: track.instrument.name, instrumentNumber: instrument };
}

export function createMidi(alias, opts = {}) {
  const midi = new Midi();
  const { name, bpm, numerator, denominator, ppq } = opts;

  if (name) midi.header.name = name;
  if (ppq) midi.header.ppq = ppq;

  // Set initial tempo
  midi.header.tempos = [{ ticks: 0, bpm: bpm || 120 }];

  // Set initial time signature
  midi.header.timeSignatures = [{
    ticks: 0,
    timeSignature: [numerator || 4, denominator || 4],
  }];

  const filePath = opts.filePath ? resolve(opts.filePath) : null;
  loaded.set(alias, { midi, filePath, dirty: true });

  return {
    alias,
    filePath,
    name: midi.header.name || '(untitled)',
    ppq: midi.header.ppq,
    tempo: bpm || 120,
    timeSignature: `${numerator || 4}/${denominator || 4}`,
    trackCount: midi.tracks.length,
  };
}

export async function saveMidi(alias, outputPath) {
  const entry = requireLoaded(alias);
  const { midi } = entry;
  const target = outputPath ? resolve(outputPath) : entry.filePath;
  if (!target) throw new Error('No file path specified and none stored. Provide an outputPath.');

  const buffer = Buffer.from(midi.toArray());
  await writeFile(target, buffer);
  entry.filePath = target;
  entry.dirty = false;

  return {
    alias,
    filePath: target,
    size: buffer.length,
    trackCount: midi.tracks.length,
    totalMeasures: totalMeasures(midi),
  };
}

export function listLoaded() {
  const entries = [];
  for (const [alias, entry] of loaded) {
    entries.push({
      alias,
      filePath: entry.filePath,
      dirty: entry.dirty,
      trackCount: entry.midi.tracks.length,
      duration: Math.round(entry.midi.duration * 100) / 100,
    });
  }
  return entries;
}

export function unloadMidi(alias) {
  const entry = loaded.get(alias);
  if (!entry) throw new Error(`No MIDI loaded with alias "${alias}".`);
  const wasDirty = entry.dirty;
  loaded.delete(alias);
  return { alias, unloaded: true, hadUnsavedChanges: wasDirty };
}

export function transposeNotes(alias, trackIndex, semitones, measureStart, measureEnd) {
  const entry = requireLoaded(alias);
  const { midi } = entry;
  const track = midi.tracks[trackIndex];
  if (!track) throw new Error(`Track ${trackIndex} does not exist.`);

  let start = 0, end = Infinity;
  if (measureStart !== undefined) {
    start = measureToTicks(midi, measureStart).start;
  }
  if (measureEnd !== undefined) {
    end = measureToTicks(midi, measureEnd).end;
  }

  let count = 0;
  for (const note of track.notes) {
    if (note.ticks >= start && note.ticks < end) {
      note.midi = Math.max(0, Math.min(127, note.midi + semitones));
      count++;
    }
  }

  entry.dirty = true;
  return { trackIndex, semitones, transposedCount: count };
}

export function quantizeNotes(alias, trackIndex, gridBeats, measureStart, measureEnd) {
  const entry = requireLoaded(alias);
  const { midi } = entry;
  const track = midi.tracks[trackIndex];
  if (!track) throw new Error(`Track ${trackIndex} does not exist.`);

  const ppq = midi.header.ppq;
  const gridTicks = Math.round(ppq * gridBeats);
  if (gridTicks <= 0) throw new Error('Grid size must be positive.');

  let start = 0, end = Infinity;
  if (measureStart !== undefined) {
    start = measureToTicks(midi, measureStart).start;
  }
  if (measureEnd !== undefined) {
    end = measureToTicks(midi, measureEnd).end;
  }

  let count = 0;
  for (const note of track.notes) {
    if (note.ticks >= start && note.ticks < end) {
      const nearest = Math.round(note.ticks / gridTicks) * gridTicks;
      note.ticks = nearest;
      // Recalculate time from ticks
      count++;
    }
  }

  entry.dirty = true;
  return { trackIndex, gridBeats, quantizedCount: count };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function noteNameToMidi(name) {
  const match = name.match(/^([A-Ga-g])(#{0,2}|b{0,2})(-?\d+)$/);
  if (!match) throw new Error(`Invalid note name: "${name}". Use format like C4, F#3, Bb5.`);
  const [, letter, accidental, octaveStr] = match;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter.toUpperCase()];
  const acc = accidental.split('').reduce((sum, ch) => sum + (ch === '#' ? 1 : -1), 0);
  const octave = parseInt(octaveStr, 10);
  const midi = (octave + 1) * 12 + base + acc;
  if (midi < 0 || midi > 127) throw new Error(`Note "${name}" results in MIDI number ${midi}, out of range 0-127.`);
  return midi;
}

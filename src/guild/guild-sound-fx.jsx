import React from 'react';
import { getAudioCtx, loadSoundSettings, noiseHit, pluckTone } from '../writing/reading-and-sound-settings.jsx';


// A brief ceremonial fanfare for the moment the Guild Hall unlocks — a low horn note under a
// rising bell arpeggio, closing with a light shimmering tail. Only ever plays once (guarded by
// GUILD_UNLOCK_SEEN_KEY below), so it's built as its own recipe rather than reusing a rarity tier.
export function playGuildUnlockSound() {
    try {
        if (!loadSoundSettings().enabled)
            return;
        const ctx = getAudioCtx();
        if (!ctx)
            return;
        if (ctx.state === 'suspended')
            ctx.resume().catch(() => { });
        const master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
        const t0 = ctx.currentTime;
        noiseHit(ctx, master, { start: t0, dur: 0.3, peak: 0.16, filterFreq: 260 });
        pluckTone(ctx, master, { freq: 130.81, start: t0, dur: 1.1, type: 'triangle', peak: 0.22, glideTo: 110 });
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            pluckTone(ctx, master, { freq, start: t0 + 0.12 + i * 0.13, dur: 0.9 - i * 0.08, type: 'sine', peak: 0.16, detune: i * 3 });
        });
        [1567.98, 2093, 2637.02].forEach((freq, i) => {
            pluckTone(ctx, master, { freq, start: t0 + 0.7 + i * 0.09, dur: 0.6 - i * 0.05, type: 'sine', peak: 0.08, detune: (i % 2 ? 6 : -6) });
        });
    }
    catch (e) { /* sound is a nice-to-have; never let it break the unlock moment */ }
}


// A ceremonial cue for the moment the Guild itself rises a level and the Hall begins construction.
// Built entirely from the same synthesized voices as the rest of the app (no audio files, fully
// offline): a low timpani-like hit opens it, a sustained low brass/string pad holds underneath
// while a rhythmic sequence of soft hammer taps plays out (timed to the construction phase's
// scaffolding/worker/stone-block visuals), then the pad swells before the existing bright rising
// bell arpeggio enters as the grand finale, closed out by one last low hit for weight — reading as
// a small "epic medieval orchestral" cue rather than a single chime.
export function playGuildLevelUpSound() {
    try {
        if (!loadSoundSettings().enabled)
            return;
        const ctx = getAudioCtx();
        if (!ctx)
            return;
        if (ctx.state === 'suspended')
            ctx.resume().catch(() => { });
        const master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
        const t0 = ctx.currentTime;
        // Opening hit: a low timpani-like thump under the first stone block landing.
        noiseHit(ctx, master, { start: t0, dur: 0.3, peak: 0.18, filterFreq: 160 });
        pluckTone(ctx, master, { freq: 65.4, start: t0, dur: 1.0, type: 'sine', peak: 0.16, glideTo: 55 });
        // The horn/brass pad: several low detuned tones held together like a sustained chord,
        // carrying the whole construction phase underneath the hammering.
        [110, 130.81, 164.81].forEach((freq, i) => {
            pluckTone(ctx, master, { freq, start: t0 + 0.05, dur: 1.9, type: 'sawtooth', peak: 0.07, detune: i * 3 - 3 });
        });
        [220, 261.63].forEach((freq, i) => {
            pluckTone(ctx, master, { freq, start: t0 + 0.25, dur: 1.5, type: 'triangle', peak: 0.05, detune: i * 4 });
        });
        // Construction hammering: a short rhythmic run of soft percussive taps, roughly matching
        // the scaffolding/worker/stone-block visuals landing during the same window.
        [0.35, 0.62, 0.89, 1.16, 1.34].forEach((offset) => {
            noiseHit(ctx, master, { start: t0 + offset, dur: 0.09, peak: 0.09, filterFreq: 900 });
        });
        // The chime: a bright rising arpeggio for the grand reveal, entering once the pad and
        // hammering have begun to fade — extended with an extra high note for a grander finish.
        const chimeStart = t0 + 1.55;
        [1046.5, 1318.51, 1567.98, 2093, 2637.02].forEach((freq, i) => {
            pluckTone(ctx, master, { freq, start: chimeStart + i * 0.1, dur: 1.0 - i * 0.1, type: 'sine', peak: 0.13, detune: i * 4 });
        });
        // A final low hit under the last bell, for weight — the "the Guild has grown" landing.
        noiseHit(ctx, master, { start: chimeStart + 0.05, dur: 0.35, peak: 0.14, filterFreq: 200 });
        pluckTone(ctx, master, { freq: 82.41, start: chimeStart + 0.05, dur: 1.1, type: 'triangle', peak: 0.15, glideTo: 65.4 });
    }
    catch (e) { /* sound is a nice-to-have; never let it break the level-up moment */ }
}


// The Guild unlock ceremony (crack, shatter, fanfare, banner) is a once-ever moment, not something
// to replay every time the Home screen mounts — so like readSeenAuthorLevel/writeSeenAuthorLevel,
// it's backed by a tiny localStorage flag rather than in-memory state.
export const GUILD_UNLOCK_SEEN_KEY = 'inkroot:guildUnlockSeen:v1';


export function readGuildUnlockSeen() {
    try {
        return localStorage.getItem(GUILD_UNLOCK_SEEN_KEY) === '1';
    }
    catch (e) {
        return false;
    }
}


export function writeGuildUnlockSeen() {
    try {
        localStorage.setItem(GUILD_UNLOCK_SEEN_KEY, '1');
    }
    catch (e) { }
}

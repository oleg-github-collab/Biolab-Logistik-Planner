/**
 * Sound effects utility for scanner and other UI interactions
 */

/**
 * Play a success beep sound (scanner beep)
 * Uses Web Audio API to generate a beep sound
 */
export function playSuccessBeep() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create oscillator for the beep tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configure beep sound
    oscillator.type = 'sine'; // Smooth sine wave
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime); // 1000 Hz - typical scanner beep

    // Volume envelope (fade in and out for smoother sound)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01); // Quick fade in
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1); // Hold
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15); // Quick fade out

    // Play the beep
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);

    // Clean up after sound finishes
    setTimeout(() => {
      audioContext.close();
    }, 200);
  } catch (error) {
    console.warn('Could not play beep sound:', error);
  }
}

/**
 * Play an error beep sound (lower pitch, longer)
 */
export function playErrorBeep() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Lower frequency for error sound
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime); // 400 Hz - lower tone

    // Volume envelope
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.2);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);

    setTimeout(() => {
      audioContext.close();
    }, 350);
  } catch (error) {
    console.warn('Could not play error beep:', error);
  }
}

/**
 * Play a double beep for special actions (e.g., deletion, completion)
 */
export function playDoubleBeep() {
  playSuccessBeep();
  setTimeout(() => {
    playSuccessBeep();
  }, 150);
}

/**
 * Play a confirmation beep (ascending tone)
 */
export function playConfirmationBeep() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    // Ascending tone from 800Hz to 1200Hz
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(1200, audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.08);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.12);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.12);

    setTimeout(() => {
      audioContext.close();
    }, 150);
  } catch (error) {
    console.warn('Could not play confirmation beep:', error);
  }
}

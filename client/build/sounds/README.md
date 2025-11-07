# Notification Sounds

This directory contains notification sound files for the Biolab Logistik Planner application.

## Required Sound File

- `notification.mp3` - The default notification sound played when new messages arrive

## Sound Requirements

- Format: MP3
- Duration: 0.5 - 2 seconds recommended
- Volume: Normalized to prevent loud notifications
- File size: < 100KB recommended

## Usage

The notification sound is played when:
- A new message is received (if notification sound is enabled in settings)
- The user is not currently viewing the message conversation
- The sound preference is set to `true` in localStorage (`notification_sound`)

## Adding a Custom Sound

1. Add your MP3 file to this directory as `notification.mp3`
2. Ensure the file meets the requirements above
3. The application will automatically use this sound

## Note

If no sound file is provided, the application will continue to function normally but without audio notifications. A console warning will be displayed when sound playback is attempted.

You can download free notification sounds from:
- https://notificationsounds.com/
- https://freesound.org/
- https://soundbible.com/

Make sure to check the licensing before using any sound files.

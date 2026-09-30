import { Volume2, VolumeX } from 'lucide-react'
import { useT } from '../i18n'
import { useAudioSettings } from '../hooks/useAudio'
import { setAudioSettings } from '../lib/audio/audioSettings'
import './AudioControl.css'

// Volume and mute for the app's one audio system (lib/audio/audioEngine.js).
// The setting is shared, so this is the same control wherever it appears: on
// the operator dashboard (`tone="plate"`, the dark cluster) and on a
// walk-around step's task panel (`tone="panel"`), where the device tests play.
export function AudioControl({ tone = 'plate' }) {
  const t = useT()
  const { volume, muted } = useAudioSettings()
  const silent = muted || volume === 0
  const muteLabel = t(muted ? 'common.audio.unmute' : 'common.audio.mute')

  return (
    <div className={`audio-control audio-control-${tone}`} role="group" aria-label={t('common.audio.label')}>
      <button
        type="button"
        className={`audio-control-mute ${muted ? 'is-muted' : ''}`}
        aria-pressed={muted}
        aria-label={muteLabel}
        title={muteLabel}
        onClick={() => setAudioSettings({ muted: !muted })}
      >
        {silent ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
      </button>
      <input
        type="range"
        className="audio-control-volume"
        min={0}
        max={100}
        step={5}
        value={Math.round(volume * 100)}
        aria-label={t('common.audio.volume')}
        title={t('common.audio.volume')}
        // Moving the slider is asking to hear it.
        onChange={(event) => setAudioSettings({ volume: Number(event.target.value) / 100, muted: false })}
        // A dragged slider would keep the focus, and the driving keys are
        // ignored while a form field has it (hooks/useDrivingInput.js).
        onPointerUp={(event) => event.currentTarget.blur()}
      />
    </div>
  )
}

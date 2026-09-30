import { useEffect, useState } from 'react'
import { translate } from '../../i18n/translate.js'
import { adminGetUserSkills, adminRevokeSkill, adminSignOffSkill } from '../../lib/api'
import { useAdminAction } from '../../hooks/useAdminAction'
import { describeEvidence, formatSkillDate, SKILL_STATUS_KEYS } from '../../lib/skillText'
import { SkillStatusBadge } from '../SkillStatusBadge'
import { Button } from '../ui/button'
import { Field } from '../ui/field'
import { Textarea } from '../ui/input'
import { PanelNote } from '../ui/panel'
import { Toolbar } from '../ui/toolbar'

// The dashboard's chrome is English (CLAUDE.md, Language).
const en = (key, values) => translate('en', key, values)

function actorLabel(event) {
  return event.actorRemoved ? `${event.actorName} (former staff)` : event.actorName
}

// The form under a skill while its sign-off or revoke is being written. A
// revoke always needs a note; a sign-off needs one when the evidence is not
// complete, saying why the instructor is confident anyway (decided
// 2026-10-01). The server applies the same rules.
function SignoffForm({ result, onSubmit, onCancel, busy }) {
  const [note, setNote] = useState('')
  const revoking = result.status === 'signed-off'
  const evidenceShort = !revoking && result.evidenceStatus !== 'demonstrated'
  const noteRequired = revoking || evidenceShort

  return (
    <div className="grid gap-2.5 rounded-lg border border-border bg-slate-50 p-3">
      {evidenceShort && (
        <p className="m-0 rounded-md bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800">
          The evidence is not complete ({result.met} of {result.total} met). Sign off only if you have seen the
          trainee do it, and say where in the note.
        </p>
      )}
      <Field label={revoking ? 'Why is it revoked? (required)' : noteRequired ? 'Note (required)' : 'Note (optional)'}>
        <Textarea rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Toolbar>
        <Button
          variant={revoking ? 'danger' : 'default'}
          disabled={busy || (noteRequired && !note.trim())}
          onClick={() => onSubmit(note.trim())}
        >
          {revoking ? 'Revoke sign-off' : 'Sign off'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
      </Toolbar>
    </div>
  )
}

// Reports > a learner > their Skills Checklist, as staff see it: per skill the
// status, the evidence met, the current sign-off with its note, a sign-off or
// revoke button, and under it all the whole trail, newest first. Everything is
// read and written through the API, which judges the evidence with the same
// lib/skillProgress.js the learner's page uses, and refuses anyone outside the
// caller's reach.
function TraineeSkills({ learner, canSignOff, onMessage }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [openSkillId, setOpenSkillId] = useState(null)
  const { busy, run } = useAdminAction(onMessage)

  const load = () =>
    adminGetUserSkills(learner.id)
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch((err) => setError(err.message))

  useEffect(() => {
    let cancelled = false
    adminGetUserSkills(learner.id)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [learner.id])

  if (error) return <PanelNote>Skills could not be loaded: {error}</PanelNote>
  if (!data) return <PanelNote>Loading skills...</PanelNote>

  const skillTitles = Object.fromEntries(data.skills.map((skill) => [skill.id, skill.title]))

  const submit = async (result, note) => {
    const revoking = result.status === 'signed-off'
    const done = await run(
      () => (revoking ? adminRevokeSkill(learner.id, result.skillId, note) : adminSignOffSkill(learner.id, result.skillId, note)),
      revoking ? 'Sign-off revoked.' : 'Skill signed off.',
    )
    if (done) {
      setOpenSkillId(null)
      await load()
    }
  }

  return (
    <div className="grid gap-3">
      <PanelNote>
        Evidence comes from progress the trainee&apos;s browser saved, so treat it as a guide. Your sign-off is the record.
      </PanelNote>

      <ul className="m-0 grid list-none gap-2 p-0">
        {data.skills.map((skill) => {
          const result = data.results.find((entry) => entry.skillId === skill.id)
          if (!result) return null
          return (
            <li key={skill.id} className="grid gap-2 border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-bold text-ink">{skill.title}</span>
                <SkillStatusBadge status={result.status} t={en} />
                <span className="text-xs text-muted">{result.met} of {result.total} evidence met</span>
                {canSignOff && openSkillId !== skill.id && (
                  <Button
                    size="sm"
                    variant={result.status === 'signed-off' ? 'secondary' : 'default'}
                    className="ml-auto"
                    onClick={() => setOpenSkillId(skill.id)}
                  >
                    {result.status === 'signed-off' ? 'Revoke' : 'Sign off'}
                  </Button>
                )}
              </div>
              {result.evidence.length > 0 && (
                <ul className="m-0 grid gap-0.5 pl-5 text-[13px] text-body">
                  {result.evidence.map(({ rule, met }, index) => (
                    <li key={index}>
                      <span className={met ? 'font-bold text-status-done' : 'text-muted'}>{met ? 'Met' : 'Not yet'}</span>
                      {': '}
                      {describeEvidence(rule, en, { staff: true })}
                    </li>
                  ))}
                </ul>
              )}
              {result.signoff && (
                <p className="m-0 text-[13px] text-body">
                  Signed off by {actorLabel(result.signoff)} on {formatSkillDate(result.signoff.createdAt)}
                  {result.signoff.note && <> &mdash; &ldquo;{result.signoff.note}&rdquo;</>}
                </p>
              )}
              {openSkillId === skill.id && (
                <SignoffForm
                  result={result}
                  busy={busy}
                  onSubmit={(note) => submit(result, note)}
                  onCancel={() => setOpenSkillId(null)}
                />
              )}
            </li>
          )
        })}
      </ul>

      <div className="grid gap-1.5">
        <p className="m-0 text-[13.5px] font-bold text-ink">Sign-off history</p>
        {data.history.length === 0 && <PanelNote>Nothing signed off or revoked yet.</PanelNote>}
        <ol className="m-0 grid gap-1 pl-5 text-[13px] text-body">
          {data.history.map((event) => (
            <li key={event.id}>
              <span className="font-bold">{event.action === 'signoff' ? 'Signed off' : 'Revoked'}</span>{' '}
              {skillTitles[event.skillId] || event.skillId} by {actorLabel(event)} on{' '}
              <time dateTime={event.createdAt} title={new Date(event.createdAt).toLocaleString()}>
                {formatSkillDate(event.createdAt)}
              </time>
              {event.note && <> &mdash; &ldquo;{event.note}&rdquo;</>}
              {event.evidenceStatus && (
                <span className="text-muted"> (evidence then: {en(SKILL_STATUS_KEYS[event.evidenceStatus]).toLowerCase()})</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export default TraineeSkills

import { useMemo, useState } from 'react'
import { HUB_CONTENT_FIELDS } from '../../data/hubContent'
import { hubContentContext, hubContentDefault, overrideKey } from '../../lib/hubContent'
import { DEFAULT_LANGUAGE, LANGUAGES } from '../../lib/language'
import { adminUpdateEquipment } from '../../lib/api'
import { Button } from '../ui/button'
import { PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input, Textarea } from '../ui/input'
import { Toolbar } from '../ui/toolbar'

// Field editor for Equipment.content - the copy on this equipment's training
// hub and module list. Every input is optional: the placeholder shows the
// coded default that renders when the field is left blank, and clearing a
// field is how an admin goes back to that default.
//
// One language layer is edited at a time. The layers share one flat object,
// keyed by overrideKey() - `heading` is English, `heading_fil` is Filipino - so
// the PATCH route stores them with no backend change. The switch below is
// deliberately NOT the app's language toggle: which copy an admin is editing
// and which language the dashboard is showing them are different questions.
//
// Mount this with key={equipment.id} - the draft is seeded from the row once,
// so switching equipment has to remount rather than resync (which would also
// throw away unsaved edits on every refetch).
function HubContentEditor({ equipment, moduleTitles = [], hasPartsPage = false, onSaved, onMessage }) {
  const [draft, setDraft] = useState(() => equipment?.content || {})
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE)
  const [saving, setSaving] = useState(false)

  const context = useMemo(
    () => hubContentContext({
      equipmentTitle: equipment?.title || 'Equipment',
      hasPartsPage,
      moduleTitles,
    }),
    [equipment, hasPartsPage, moduleTitles],
  )

  if (!equipment) return <PanelNote>Select an equipment to edit its hub copy.</PanelNote>

  const isDefaultLanguage = language === DEFAULT_LANGUAGE
  const languageName = LANGUAGES.find((entry) => entry.code === language)?.name || language

  const sections = HUB_CONTENT_FIELDS.reduce((grouped, field) => {
    grouped[field.section] = [...(grouped[field.section] || []), field]
    return grouped
  }, {})

  // Only this language's keys - the count drives the Reset button, which is
  // scoped the same way. A single setDraft({}) would wipe both layers.
  const activeKeys = new Set(HUB_CONTENT_FIELDS.map((field) => overrideKey(field.key, language)))
  const overrideCount = Object.entries(draft).filter(
    ([key, value]) => activeKeys.has(key) && typeof value === 'string' && value.trim(),
  ).length

  const resetActiveLanguage = () => {
    setDraft(Object.fromEntries(Object.entries(draft).filter(([key]) => !activeKeys.has(key))))
  }

  const save = async () => {
    setSaving(true)
    try {
      const result = await adminUpdateEquipment(equipment.id, { content: draft })
      onSaved?.(result.equipment)
      onMessage?.('Hub content saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PanelNote>
        Copy shown on {equipment.title}&apos;s training hub and module list. Leave a field blank to use the
        default in the placeholder. <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{'{equipment}'}</code>{' '}
        and <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{'{learner}'}</code> are replaced with the
        equipment title and the signed-in learner&apos;s name.
      </PanelNote>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[13px] font-bold text-body">Editing</span>
        <div role="group" aria-label="Content language" className="inline-flex items-center gap-1">
          {LANGUAGES.map((entry) => (
            <Button
              key={entry.code}
              size="sm"
              variant={entry.code === language ? 'default' : 'secondary'}
              aria-pressed={entry.code === language}
              onClick={() => setLanguage(entry.code)}
            >
              {entry.name}
            </Button>
          ))}
        </div>
      </div>

      {!isDefaultLanguage && (
        <PanelNote>
          A blank {languageName} field falls back to this equipment&apos;s English copy first, and only then to
          the stock {languageName} default - so copy an admin wrote for this equipment is never contradicted by
          a translation nobody asked for.
        </PanelNote>
      )}

      <div className="mt-3 grid gap-3.5">
        {Object.entries(sections).map(([section, fields]) => (
          <fieldset
            key={section}
            className="m-0 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] items-start gap-3 rounded-xl border border-border bg-slate-50 p-4"
          >
            <legend className="px-1 text-[13px] font-bold text-body">{section}</legend>
            {fields.map((field) => {
              const key = overrideKey(field.key, language)
              const value = typeof draft[key] === 'string' ? draft[key] : ''
              const placeholder = hubContentDefault(field.key, context, language)
              const onChange = (event) => setDraft({ ...draft, [key]: event.target.value })

              // What this field would actually fall back to, shown only when it
              // is not already the placeholder: the English override.
              const englishOverride = isDefaultLanguage
                ? ''
                : (typeof draft[field.key] === 'string' ? draft[field.key].trim() : '')

              return (
                <Field
                  key={key}
                  label={field.label}
                  note={englishOverride ? `English: ${englishOverride}` : undefined}
                >
                  {field.multiline
                    ? <Textarea rows={3} value={value} placeholder={placeholder} onChange={onChange} />
                    : <Input value={value} placeholder={placeholder} onChange={onChange} />}
                </Field>
              )
            })}
          </fieldset>
        ))}
      </div>

      <Toolbar>
        <Button onClick={save} disabled={saving}>Save hub content</Button>
        <Button variant="secondary" onClick={resetActiveLanguage} disabled={overrideCount === 0}>
          Reset {languageName} to default
        </Button>
      </Toolbar>
      <PanelNote>
        {overrideCount === 0
          ? `No ${languageName} overrides - every field is using its default.`
          : `${overrideCount} ${languageName} field${overrideCount === 1 ? '' : 's'} overridden.`}
      </PanelNote>
    </>
  )
}

export default HubContentEditor

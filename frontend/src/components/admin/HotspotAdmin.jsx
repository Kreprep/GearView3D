import { useEffect, useState } from 'react'
import { useAdminAction } from '../../hooks/useAdminAction'
import HotspotViewer from '../HotspotViewer'
import {
  adminCreateHotspot,
  adminDeleteHotspot,
  adminListHotspots,
  adminPublishHotspot,
  adminReorderHotspots,
  adminResetHotspot,
  adminRevertHotspot,
  adminSaveHotspotDraft,
} from '../../lib/api'
import { Button } from '../ui/button'
import { Panel, PanelHeader, PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input, Textarea, Select, Checkbox } from '../ui/input'
import { Toolbar } from '../ui/toolbar'
import { Badge } from '../ui/badge'

// The one editor for every marker on the model. A hotspot is one
// physical component, and `inParts` / `inWalkAround` say which surfaces show
// it - so the forklift's mast is edited here once, not once as a part and
// again as an inspection hotspot.
//
// `surface` scopes the list to the page that mounted this ('parts' under Parts
// Identification, 'walk-around' inside a Walk Around step) and decides which
// surfaces a newly created hotspot starts on. The other surface's fields are
// still reachable, because one row can be on both.

const STATE_OPTIONS = [
  ['', 'Every phase'],
  ['engine-off', 'Engine-off'],
  ['engine-on', 'Engine-on'],
  ['ignition', 'Ignition'],
]

const DEFAULT_POSITION = [0, 0.3, 0]

// Everything an admin can edit. Mirrors hotspotDraftFields on the backend, so a
// draft round-trips without losing a field.
function draftOf(hotspot) {
  const source = hotspot.draft ? { ...hotspot, ...hotspot.draft } : hotspot
  return {
    label: source.label || '',
    position: source.position || null,
    inParts: Boolean(source.inParts),
    inWalkAround: Boolean(source.inWalkAround),
    title: source.title || '',
    subtitle: source.subtitle || '',
    image: source.image || '',
    description: source.description || '',
    category: source.category || '',
    functionText: source.functionText || '',
    inspectionReminder: source.inspectionReminder || '',
    safetyNote: source.safetyNote || '',
    relatedModule: source.relatedModule || '',
    checklist: source.checklist || [],
    inspectCategory: source.inspectCategory || '',
    state: source.state || '',
    inspect: source.inspect || '',
    safeFeedback: source.safeFeedback || '',
    unsafeFeedback: source.unsafeFeedback || '',
    unsafeScenarios: source.unsafeScenarios || [],
  }
}

function onSurface(hotspot, surface) {
  if (surface === 'parts') return hotspot.inParts
  if (surface === 'walk-around') return hotspot.inWalkAround
  return true
}

function HotspotAdmin({ categories = [], surface = null, onMessage }) {
  const [hotspots, setHotspots] = useState([])
  const [loadState, setLoadState] = useState({ loading: true, error: null })
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false

    adminListHotspots()
      .then((data) => {
        if (cancelled) return
        setHotspots(data.hotspots)
        setLoadState({ loading: false, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        setLoadState({ loading: false, error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const sorted = [...hotspots].sort((a, b) => a.sortOrder - b.sortOrder)
  const visible = showAll || !surface ? sorted : sorted.filter((row) => onSurface(row, surface))
  const hidden = sorted.length - visible.length
  const stored = hotspots.find((row) => row.id === selectedId) || null

  const select = (row) => {
    if (row.id === selectedId) return
    if (dirty && !window.confirm('Discard the unsaved changes to this hotspot?')) return

    setSelectedId(row.id)
    setDraft(draftOf(row))
    setPlacing(false)
    setDirty(false)
  }

  const setField = (patch) => {
    setDraft((current) => ({ ...current, ...patch }))
    setDirty(true)
  }

  const replace = (hotspot) => {
    setHotspots((current) => current.map((entry) => (entry.id === hotspot.id ? hotspot : entry)))
  }

  const { busy, run } = useAdminAction(onMessage, (result, { resync = false } = {}) => {
    if (result?.hotspot) {
      replace(result.hotspot)
      setDirty(false)
      if (resync) setDraft(draftOf(result.hotspot))
    }
  })

  const saveDraft = () => run(() => adminSaveHotspotDraft(selectedId, draft), 'Draft saved.')

  const publish = async () => {
    const saved = await run(() => adminSaveHotspotDraft(selectedId, draft), null)
    if (!saved) return
    await run(() => adminPublishHotspot(selectedId), 'Published - learners see this now.')
  }

  const revert = () => {
    if (!window.confirm('Discard the unpublished draft and go back to the published version?')) return
    return run(() => adminRevertHotspot(selectedId), 'Draft discarded.', { resync: true })
  }

  const reset = () => {
    if (!window.confirm('Reset this hotspot to its built-in default? Current position and text are replaced.')) return
    return run(() => adminResetHotspot(selectedId), 'Hotspot reset to default.', { resync: true })
  }

  const remove = async () => {
    if (!window.confirm(`Delete "${draft.label}"? Learners will no longer see it on any page.`)) return

    const result = await run(() => adminDeleteHotspot(selectedId), 'Hotspot deleted.')
    if (!result) return
    setHotspots((current) => current.filter((entry) => entry.id !== selectedId))
    setSelectedId(null)
    setDraft(null)
  }

  // A new hotspot starts unpublished, on whichever surface asked for it, with a
  // marker in the middle of the model waiting to be placed.
  const create = async () => {
    if (!newLabel.trim()) return

    const result = await run(
      () => adminCreateHotspot({
        label: newLabel.trim(),
        position: DEFAULT_POSITION,
        inParts: surface !== 'walk-around',
        inWalkAround: surface === 'walk-around',
      }),
      'Hotspot created. Place it on the model, then Publish.',
    )
    if (!result) return

    setHotspots((current) => [...current, result.hotspot])
    setSelectedId(result.hotspot.id)
    setDraft(draftOf(result.hotspot))
    setDirty(false)
    setNewLabel('')
  }

  const move = async (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= sorted.length) return

    const reordered = [...sorted]
    const [entry] = reordered.splice(index, 1)
    reordered.splice(target, 0, entry)

    try {
      const result = await adminReorderHotspots(reordered.map((row) => row.id))
      setHotspots(result.hotspots)
    } catch (err) {
      onMessage(err.message)
    }
  }

  if (loadState.loading) return <PanelNote>Loading hotspots...</PanelNote>
  if (loadState.error) return <PanelNote>Hotspots could not be loaded: {loadState.error}</PanelNote>

  // Every placed marker is on the model, not just the selected one: placing a
  // spot is a judgement about where it sits relative to its neighbours. The
  // selected one shows its live (possibly unsaved) position; clicking any other
  // switches the editor to it, and dragging moves whichever is selected.
  const markers = sorted
    .map((row) => {
      const source = row.id === selectedId && draft ? draft : (row.draft ? { ...row, ...row.draft } : row)
      return { id: row.id, label: source.label, position: source.position }
    })
    .filter((marker) => Array.isArray(marker.position))

  const handleMarkerSelect = (marker) => {
    const row = hotspots.find((entry) => entry.id === marker.id)
    if (row) select(row)
  }

  const handleMarkerDrag = (id, next) => {
    // Only the selected marker moves; a drag that starts on another one has
    // already selected it through the click above.
    if (id === selectedId) setField({ position: next })
  }

  const summaryOf = (row) => {
    const source = row.draft ? { ...row, ...row.draft } : row
    const surfaces = [source.inParts && 'Parts', source.inWalkAround && 'Walk-around'].filter(Boolean)
    return [
      surfaces.join(' + ') || 'Detail card only',
      row.draft && 'draft',
      !row.published && 'unpublished',
      !row.builtIn && 'custom',
    ].filter(Boolean).join(' - ')
  }

  return (
    <div className="grid items-start gap-4 [grid-template-columns:minmax(240px,300px)_minmax(0,1fr)] max-[1000px]:grid-cols-1">
      <Panel className="sticky top-3">
        <PanelHeader>Hotspots</PanelHeader>
        <PanelNote>
          Every labelled point on the model. One hotspot is one component - tick the surfaces it
          appears on rather than adding it twice.
        </PanelNote>

        <ol className="m-0 mt-2.5 grid list-none gap-1.5 p-0">
          {visible.map((row) => {
            const index = sorted.indexOf(row)
            return (
              <li
                key={row.id}
                className={`flex items-center gap-1.5 rounded-lg border px-0.5 ${
                  row.id === selectedId ? 'border-accent bg-accent-soft' : 'border-transparent'
                }`}
              >
                <button type="button" className="grid flex-1 gap-0.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100" onClick={() => select(row)}>
                  <strong className="text-[13.5px] font-bold leading-snug text-ink">{(row.draft ? { ...row, ...row.draft } : row).label}</strong>
                  <small className="text-xs text-muted">{summaryOf(row)}</small>
                </button>
                <span className="flex flex-none gap-1">
                  <Button type="button" size="sm" variant="secondary" title="Move up" onClick={() => move(index, -1)} disabled={index === 0}>Up</Button>
                  <Button type="button" size="sm" variant="secondary" title="Move down" onClick={() => move(index, 1)} disabled={index === sorted.length - 1}>Down</Button>
                </span>
              </li>
            )
          })}
        </ol>

        {visible.length === 0 && <PanelNote className="mt-2">No hotspots yet.</PanelNote>}

        {hidden > 0 && (
          <Button type="button" size="sm" variant="secondary" className="mt-2.5" onClick={() => setShowAll(true)}>
            Show {hidden} more not on this page
          </Button>
        )}
        {showAll && surface && (
          <Button type="button" size="sm" variant="secondary" className="mt-2.5" onClick={() => setShowAll(false)}>
            Show only this page&apos;s hotspots
          </Button>
        )}

        <div className="mt-3 grid gap-2.5 border-t border-slate-200 pt-3">
          <Field label="New hotspot label">
            <Input value={newLabel} placeholder="Tilt Cylinder" onChange={(event) => setNewLabel(event.target.value)} />
          </Field>
          <Button type="button" onClick={create} disabled={!newLabel.trim() || busy}>
            Add hotspot
          </Button>
        </div>
      </Panel>

      <div className="min-w-0">
        {!draft ? (
          <PanelNote>Select a hotspot to reposition or edit it, or add a new one.</PanelNote>
        ) : (
          <div className="grid gap-4">
            <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-panel p-4">
              <div>
                <h2 className="m-0 text-[18px] font-extrabold text-ink">{draft.label}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                  {selectedId}
                  {stored?.draft && <Badge tone="warning">Unpublished draft</Badge>}
                  {!stored?.published && <Badge tone="neutral">Not visible to learners</Badge>}
                  {dirty && <Badge tone="danger">Unsaved changes</Badge>}
                </p>
              </div>
              <Toolbar className="mt-0">
                <Button type="button" variant="secondary" onClick={saveDraft} disabled={busy}>Save draft</Button>
                <Button type="button" onClick={publish} disabled={busy}>Publish</Button>
                {stored?.draft && <Button type="button" variant="secondary" onClick={revert} disabled={busy}>Discard draft</Button>}
                {stored?.builtIn && <Button type="button" variant="secondary" onClick={reset} disabled={busy}>Reset to default</Button>}
                <Button type="button" variant="danger" onClick={remove} disabled={busy}>Delete hotspot</Button>
              </Toolbar>
            </header>

            <div className="grid items-start gap-4 [grid-template-columns:minmax(0,1fr)_minmax(300px,380px)] max-[1100px]:grid-cols-1">
              <section className="grid min-w-0 gap-2.5">
                {draft.position ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={placing ? 'default' : 'secondary'}
                      className="justify-self-start"
                      onClick={() => setPlacing((value) => !value)}
                    >
                      {placing ? 'Cancel placement' : 'Place hotspot'}
                    </Button>
                    <div className="min-h-[480px] w-full">
                      <HotspotViewer
                        isAdmin
                        adminEditMode
                        placingActive={placing}
                        hotspots={markers}
                        selectedHotspotId={selectedId}
                        onHotspotSelect={handleMarkerSelect}
                        onPlaceHotspot={(next) => { setField({ position: next }); setPlacing(false) }}
                        onDragHotspot={handleMarkerDrag}
                      />
                    </div>
                    <PanelNote>
                      Every placed hotspot is marked on the model. Click a marker to edit it, drag the selected one to
                      move it, or use Place hotspot to click a new spot. Position:{' '}
                      {draft.position.map((value) => Number(value).toFixed(3)).join(', ')}
                    </PanelNote>
                  </>
                ) : (
                  <>
                    <PanelNote>
                      This is a detail card with no marker of its own - a check that describes something the model has
                      no separate point for. Give it a position to put it on the model.
                    </PanelNote>
                    <Button type="button" size="sm" variant="secondary" className="justify-self-start" onClick={() => setField({ position: DEFAULT_POSITION })}>
                      Add a marker
                    </Button>
                  </>
                )}
              </section>

              <Panel className="grid content-start gap-2.5">
                <Field label="Label">
                  <Input value={draft.label} onChange={(event) => setField({ label: event.target.value })} />
                </Field>

                <fieldset className="m-0 grid gap-1.5 rounded-lg border border-border p-2.5">
                  <legend className="px-1 text-xs font-bold text-body">Shown on</legend>
                  <Checkbox label="Parts Identification" checked={draft.inParts} onChange={(event) => setField({ inParts: event.target.checked })} />
                  <Checkbox label="Walk-around inspection" checked={draft.inWalkAround} onChange={(event) => setField({ inWalkAround: event.target.checked })} />
                </fieldset>

                <h3 className="m-0 mt-1 text-sm font-extrabold text-ink">Detail card</h3>
                <PanelNote>Shown when this marker is clicked, on every surface it appears on.</PanelNote>
                <Field label="Title">
                  <Input value={draft.title} placeholder={draft.label} onChange={(event) => setField({ title: event.target.value })} />
                </Field>
                <Field label="Subtitle">
                  <Input value={draft.subtitle} onChange={(event) => setField({ subtitle: event.target.value })} />
                </Field>
                <Field label="Reference image URL">
                  <Input value={draft.image} placeholder="/images/forks.png" onChange={(event) => setField({ image: event.target.value })} />
                </Field>
                <Field label="Description (Markdown)">
                  <Textarea rows={10} value={draft.description} onChange={(event) => setField({ description: event.target.value })} />
                </Field>
                <PanelNote>
                  Supports markdown: **bold**, - bullet points, 1. numbered lists, and inline images via
                  ![alt](/images/example.png).
                </PanelNote>

                {draft.inParts && (
                  <>
                    <h3 className="m-0 mt-1 text-sm font-extrabold text-ink">Parts Identification</h3>
                    <Field label="Category">
                      <Input
                        value={draft.category}
                        list="hotspot-category-options"
                        onChange={(event) => setField({ category: event.target.value })}
                      />
                    </Field>
                    <datalist id="hotspot-category-options">
                      {categories.map((category) => (
                        <option key={category.id} value={category.label} />
                      ))}
                    </datalist>
                    <Field label="Function">
                      <Textarea rows={3} value={draft.functionText} onChange={(event) => setField({ functionText: event.target.value })} />
                    </Field>
                    <Field label="Inspection reminder">
                      <Textarea rows={2} value={draft.inspectionReminder} onChange={(event) => setField({ inspectionReminder: event.target.value })} />
                    </Field>
                    <Field label="Safety note">
                      <Textarea rows={2} value={draft.safetyNote} onChange={(event) => setField({ safetyNote: event.target.value })} />
                    </Field>
                    <Field label="Related module">
                      <Input value={draft.relatedModule} onChange={(event) => setField({ relatedModule: event.target.value })} />
                    </Field>
                  </>
                )}

                {draft.inWalkAround && (
                  <>
                    <h3 className="m-0 mt-1 text-sm font-extrabold text-ink">Walk-around inspection</h3>
                    <PanelNote>
                      This marker&apos;s position, phase visibility and defect-overlay reaction. It does
                      <strong> not</strong> decide which checks a step grades or their pass/fail text - that&apos;s
                      the step&apos;s own Walk-around content panel, matched to this marker by id.
                    </PanelNote>
                    <Field
                      label="Inspection grouping"
                      note="Separate from the parts category above, because the same component is grouped differently when it is being inspected."
                    >
                      <Input value={draft.inspectCategory} onChange={(event) => setField({ inspectCategory: event.target.value })} />
                    </Field>
                    <Field
                      label="Engine phase"
                      note="Which walk-around phase shows this marker. Every phase shows it in all of them."
                    >
                      <Select value={draft.state} onChange={(event) => setField({ state: event.target.value })}>
                        {STATE_OPTIONS.map(([value, text]) => (
                          <option key={value} value={value}>{text}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label="Marker fallback text"
                      note="Shown when this marker is clicked outside of an engine-off check - as an engine-on device test's description, or when the marker has no matching check at all. An engine-off check's own &quot;What to inspect&quot; text (in the step's Walk-around content panel) is what the learner sees for that check."
                    >
                      <Textarea rows={3} value={draft.inspect} onChange={(event) => setField({ inspect: event.target.value })} />
                    </Field>
                    <Field label="Safe feedback">
                      <Textarea rows={2} value={draft.safeFeedback} onChange={(event) => setField({ safeFeedback: event.target.value })} />
                    </Field>
                    <Field
                      label="Unsafe feedback"
                      note="Not shown to learners at present: defect scenarios now change the model itself (the Defect Recognition step's own panel picks the defects)."
                    >
                      <Textarea rows={2} value={draft.unsafeFeedback} onChange={(event) => setField({ unsafeFeedback: event.target.value })} />
                    </Field>
                  </>
                )}
              </Panel>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HotspotAdmin

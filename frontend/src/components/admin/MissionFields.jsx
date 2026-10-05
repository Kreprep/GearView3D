import { useState } from 'react'
import { addTask, moveTask, removeTask, taskItemKey, updateTask } from '../../lib/courseEdit'
import { COUNTED_ALERT_RULES } from '../../lib/courseAlerts'
import { palletTarget } from '../../lib/coursePallets'
import { MISSION_TASK_LABELS, MISSION_TASK_TYPES } from '../../lib/missionTasks'
import { DEFAULT_PASS_RULES, PASS_RULE_PENALTY_KEYS, resolvePassRules } from '../../lib/missionScore'
import { RACK_LEVEL_LABELS } from '../../data/rackProfile'
import { Button } from '../ui/button'
import { Field } from '../ui/field'
import { Checkbox, Input, Select } from '../ui/input'
import { Panel, PanelHeader, PanelNote } from '../ui/panel'

// The Course Editor's panels for a mission course (goalType 'mission', the
// Final Driving Test): its ordered task list (lib/missionTasks.js) and its
// pass rules (lib/missionScore.js). Both write course data through the
// editor's `onChange(nextData)`; validateCourse() reports what is wrong.

function palletChoiceLabel(pallet) {
  const target = palletTarget(pallet)
  const where = target?.rack ? `rack ${target.rack}, ${RACK_LEVEL_LABELS[target.level]?.toLowerCase() || target.level}` : target?.zone ? `zone ${target.zone}` : 'any drop zone'
  return `${pallet.id} (${pallet.weightKg ?? '?'} kg, to ${where})`
}

// What a task can name: checkpoints by label, pallets with where they go.
function refChoices(type, data) {
  if (type === 'checkpoint') return (data.checkpoints || []).map((checkpoint) => [checkpoint.id, checkpoint.label || checkpoint.id])
  if (type === 'deliver') return (data.pallets || []).map((pallet) => [pallet.id, palletChoiceLabel(pallet)])
  return []
}

export function MissionTasksPanel({ data, onChange, onSelectItem }) {
  const [newType, setNewType] = useState('checkpoint')
  const tasks = data.tasks || []

  return (
    <Panel>
      <PanelHeader>Tasks</PanelHeader>
      <PanelNote>
        Done in this order. A checkpoint counts only while its task is the current one; a pallet delivered or the
        truck parked early counts as soon as that task comes up. Start the truck can only be first, and Park and
        secure only last. The label is what the learner reads at the top of the screen.
      </PanelNote>
      <ol className="m-0 mt-3 grid list-none gap-2.5 p-0">
        {tasks.map((task, index) => {
          const choices = refChoices(task.type, data)
          const itemKey = taskItemKey(data, task)
          return (
            <li key={task.id || index} className="grid gap-2 rounded-lg border border-border p-2.5">
              <p className="m-0 text-[13px] font-semibold text-ink">
                {index + 1}. {MISSION_TASK_LABELS[task.type] || task.type}
              </p>
              <Field label="Label">
                <Input value={task.label || ''} onChange={(event) => onChange(updateTask(data, index, { label: event.target.value }))} />
              </Field>
              {(task.type === 'checkpoint' || task.type === 'deliver') && (
                <Field label={task.type === 'deliver' ? 'Pallet' : 'Checkpoint'}>
                  <Select value={task.ref || ''} onChange={(event) => onChange(updateTask(data, index, { ref: event.target.value }))}>
                    <option value="">Choose one</option>
                    {choices.map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </Select>
                </Field>
              )}
              <span className="flex flex-wrap gap-1">
                <Button type="button" size="sm" variant="secondary" onClick={() => onChange(moveTask(data, index, -1))} disabled={index === 0}>Up</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onChange(moveTask(data, index, 1))} disabled={index === tasks.length - 1}>Down</Button>
                {itemKey && <Button type="button" size="sm" variant="secondary" onClick={() => onSelectItem(itemKey)}>Show on map</Button>}
                <Button type="button" size="sm" variant="danger" onClick={() => onChange(removeTask(data, index))}>Remove</Button>
              </span>
            </li>
          )
        })}
      </ol>
      {tasks.length === 0 && <PanelNote className="mt-2">No tasks yet: a mission needs at least one.</PanelNote>}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Field label="New task" className="min-w-[180px] flex-1">
          <Select value={newType} onChange={(event) => setNewType(event.target.value)}>
            {MISSION_TASK_TYPES.map((type) => (
              <option key={type} value={type}>{MISSION_TASK_LABELS[type]}</option>
            ))}
          </Select>
        </Field>
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange(addTask(data, newType))}>Add task</Button>
      </div>
    </Panel>
  )
}

// A number field over one pass-rule key: blank stores nothing, so the course
// keeps following the stock value.
function RuleNumber({ label, value, onChange, max }) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min={0}
        max={max}
        step={1}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
      />
    </Field>
  )
}

const PENALTY_LABELS = {
  cautionPenalty: 'Points off per caution',
  cleanRulePenalty: 'Points off per caution on a must-be-clean sign',
  dangerPenalty: 'Points off per danger',
}

// `passRules` stores only what the course changes; everything else follows
// DEFAULT_PASS_RULES, so a change to the stock rules reaches this course.
export function MissionPassRulesPanel({ data, onChange }) {
  const stored = data.passRules || {}
  const rules = resolvePassRules(data)

  const setRule = (key, value) => {
    const next = { ...stored, [key]: value }
    if (value === undefined) delete next[key]
    onChange({ ...data, passRules: Object.keys(next).length ? next : undefined })
  }
  const toggleClean = (id, on) =>
    setRule('cleanRules', on ? [...rules.cleanRules, id] : rules.cleanRules.filter((entry) => entry !== id))

  return (
    <Panel>
      <PanelHeader>Pass rules</PanelHeader>
      <PanelNote>
        A finished run passes with no danger sign, no more caution signs than allowed, and no sign at all for the
        rules ticked below; only a pass completes the step. The score out of 100 is shown with the result. Blank
        fields follow the stock rules ({DEFAULT_PASS_RULES.maxCautions} cautions; {DEFAULT_PASS_RULES.cautionPenalty},{' '}
        {DEFAULT_PASS_RULES.cleanRulePenalty} and {DEFAULT_PASS_RULES.dangerPenalty} points off).
      </PanelNote>
      <div className="mt-3 grid gap-3">
        <RuleNumber label="Most caution signs allowed" value={stored.maxCautions} onChange={(value) => setRule('maxCautions', value)} />
        {PASS_RULE_PENALTY_KEYS.map((key) => (
          <RuleNumber key={key} label={PENALTY_LABELS[key]} max={100} value={stored[key]} onChange={(value) => setRule(key, value)} />
        ))}
        <fieldset className="m-0 grid gap-1.5 border-0 p-0">
          <legend className="mb-1.5 text-[13.5px] font-bold text-body">Signs that must not come up at all</legend>
          {COUNTED_ALERT_RULES.map((rule) => (
            <Checkbox
              key={rule.id}
              label={rule.label}
              checked={rules.cleanRules.includes(rule.id)}
              onChange={(event) => toggleClean(rule.id, event.target.checked)}
            />
          ))}
        </fieldset>
        {data.passRules && (
          <Button type="button" size="sm" variant="secondary" className="justify-self-start" onClick={() => onChange({ ...data, passRules: undefined })}>
            Back to the stock pass rules
          </Button>
        )}
      </div>
    </Panel>
  )
}

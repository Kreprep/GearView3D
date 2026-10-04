import { Button } from '../ui/button'
import { PanelNote } from '../ui/panel'
import { Toolbar } from '../ui/toolbar'

// A list of rows edited the same way: patch one row, drop one row, or append
// a blank one. The walk-around step's checks, gauges, devices and defect
// scenarios all use it. `legendFor(item, index)` names a row; by default its
// label or title.
export function ListEditor({ title, note, items, onChange, emptyItem, renderFields, legendFor }) {
  const patch = (index, changes) =>
    onChange(items.map((item, position) => (position === index ? { ...item, ...changes } : item)))

  return (
    <div className="mt-4 grid gap-2.5 border-t border-slate-200 pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <h4 className="m-0 text-sm font-extrabold text-ink">{title}</h4>
      {note && <PanelNote>{note}</PanelNote>}

      {items.map((item, index) => (
        <fieldset
          key={item.id || index}
          className="m-0 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] items-start gap-3 rounded-xl border border-border bg-slate-50 p-4"
        >
          <legend className="px-1 text-[13px] font-bold text-body">
            {legendFor ? legendFor(item, index) : item.label || item.title || `Item ${index + 1}`}
          </legend>
          {renderFields(item, (changes) => patch(index, changes), index)}
          <Toolbar className="col-span-full">
            <Button type="button" size="sm" variant="danger" onClick={() => onChange(items.filter((_, position) => position !== index))}>
              Remove
            </Button>
          </Toolbar>
        </fieldset>
      ))}
      {items.length === 0 && <PanelNote>Nothing here yet.</PanelNote>}

      <Button type="button" variant="secondary" className="justify-self-start" onClick={() => onChange([...items, emptyItem()])}>Add</Button>
    </div>
  )
}

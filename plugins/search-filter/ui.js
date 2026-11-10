// The web UI part of the plugin: a text filter bar above the download list / the linkgrabber list.
// The host loads this module in the browser and calls the default export once.

// Shared across both bars (one per list), so the filter stays whatever it was when the list was last shown.
const scopes = ['downloads', 'linkgrabber']

const matches = (name, s) => {
  if (!s.text) return true
  const hit = name.toLowerCase().includes(s.text.toLowerCase())
  return s.exclude ? !hit : hit
}

// Minimal inline icons (no icon library available to a plugin's UI module).
const icon = (h, paths) => h('svg', { viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, paths)
const searchIcon = (h) => icon(h, [h('circle', { cx: 11, cy: 11, r: 8 }), h('line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 })])
const excludeIcon = (h) => icon(h, [h('circle', { cx: 12, cy: 12, r: 10 }), h('line', { x1: 8, y1: 12, x2: 16, y2: 12 })])

export default function register({ Vue, block, registerListFilter }) {
  const { defineComponent, h, reactive } = Vue

  const state = reactive(Object.fromEntries(scopes.map((s) => [s, { text: '', exclude: false }])))
  for (const s of scopes) registerListFilter(s, (name) => matches(name, state[s]))

  const SearchBar = defineComponent({
    props: { scope: String },
    setup(props) {
      const s = state[props.scope]
      return () =>
        h(
          'div',
          {
            style: `display:flex;align-items:center;gap:10px;background:transparent;border:1px solid var(--border);border-radius:10px;padding:8px 12px;outline:2px solid ${s.text ? 'var(--accent)' : 'transparent'}`
          },
          [
            h('span', { style: 'display:inline-flex;color:var(--muted);flex:none' }, [searchIcon(h)]),
            h('input', {
              type: 'text',
              value: s.text,
              placeholder: 'Search…',
              onInput: (e) => (s.text = e.target.value),
              style: 'flex:1;min-width:140px;background:transparent;color:var(--text);border:0;outline:0;padding:0;font:inherit'
            }),
            h('button', {
              type: 'button',
              title: s.exclude ? 'Showing everything except matches — click to show matches instead' : 'Click to hide matches instead of showing them',
              onClick: () => (s.exclude = !s.exclude),
              style: `display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;border-radius:999px;border:0;cursor:pointer;background:${s.exclude ? 'var(--accent)' : 'transparent'};color:${s.exclude ? '#fff' : 'var(--muted)'}`
            }, [excludeIcon(h)])
          ]
        )
    }
  })

  block('downloads-toolbar', SearchBar)
  block('linkgrabber-toolbar', SearchBar)
}

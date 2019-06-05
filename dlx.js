// opts eg:
// [
//   [2, 4],
//   [0, 3, 6],
//   [1, 2, 5],
//   [0, 3, 5],
//   [1, 6],
//   [3, 4, 6]
// ]
function initialize(opts) {
  const nItems = Math.max(...opts.map(o => Math.max(...o))) + 1
  const nNodes = opts.reduce((m, o) => m + o.length, 0)
  const nSpacers = opts.length + 1
  const size = (nItems + 1) * 2 + (nItems + 1) * 3 + (nNodes + nSpacers) * 3
  // everything in |mem| is a pointer to something else in |mem|
  // pick the smallest pointer size for cache locality
  const mem = new (size < 256 ? Int8Array : size < 65536 ? Int16Array : Int32Array)(size)

  for (let i = 0; i < nItems; i++) {
    const endPrev = mem[0]
    const endNext = mem[1]
    const newItemIdx = endPrev + 1
    const newItemLoc = newItemIdx * 2
    // newItem.prev = end.prev
    mem[newItemLoc] = endPrev
    // newItem.next = end
    mem[newItemLoc + 1] = 0
    // newItem.prev.next = newItem
    mem[mem[newItemLoc] * 2 + 1] = newItemIdx
    // newItem.next.prev = newItem
    mem[mem[newItemLoc + 1] * 2] = newItemIdx
  }


  const itemBase = (nItems + 1) * 2
  for (let i = 1; i < nItems + 1; i++) {
    mem[itemBase + i * 3] = 0 // length
    mem[itemBase + i * 3 + 1] = i // ulink
    mem[itemBase + i * 3 + 2] = i // dlink
  }

  let nextItemIdx = nItems + 1

  let prevOptFirstItem = 0xdeadbeef
  opts.forEach((opt, i) => {
    // spacer
    const spacerLoc = itemBase + nextItemIdx * 3
    mem[spacerLoc] = -i
    mem[spacerLoc + 1] = prevOptFirstItem
    nextItemIdx += 1
    prevOptFirstItem = nextItemIdx
    const firstItem = nextItemIdx
    opt.forEach((item, j) => {
      const headerIdx = item + 1
      const headerLoc = itemBase + headerIdx * 3
      const itemIdx = nextItemIdx
      const itemLoc = itemBase + itemIdx * 3
      mem[headerLoc] += 1 // header.length += 1
      mem[itemLoc] = headerIdx // top
      mem[itemLoc + 1] = mem[headerLoc + 1] // this.prev = header.prev
      mem[itemLoc + 2] = headerIdx // this.next = header
      mem[itemBase + mem[itemLoc + 1] * 3 + 2] = itemIdx // this.prev.next = this
      mem[itemBase + mem[itemLoc + 2] * 3 + 1] = itemIdx // this.next.prev = this
      nextItemIdx += 1
    })
    mem[spacerLoc + 2] = nextItemIdx - 1
  })
  mem[itemBase + nextItemIdx * 3] = -opts.length
  mem[itemBase + nextItemIdx * 3 + 1] = prevOptFirstItem
  mem[itemBase + nextItemIdx * 3 + 2] = 0xdeadbeef

  const lastSpacer = nextItemIdx

  //console.log(JSON.stringify([...mem]))
  return {
    mem,
    nItems,
    lastSpacer,
    top(i) {
      return mem[itemBase + i * 3]
    },
    len(i) {
      return mem[itemBase + i * 3]
    },
    setLen(i, v) {
      mem[itemBase + i * 3] = v
    },
    ulink(i) {
      return mem[itemBase + i * 3 + 1]
    },
    dlink(i) {
      return mem[itemBase + i * 3 + 2]
    },
    setUlink(i, v) {
      mem[itemBase + i * 3 + 1] = v
    },
    setDlink(i, v) {
      mem[itemBase + i * 3 + 2] = v
    },
    llink(i) {
      return mem[i * 2]
    },
    rlink(i) {
      return mem[i * 2 + 1]
    },
    setLlink(i, v) {
      mem[i * 2] = v
    },
    setRlink(i, v) {
      mem[i * 2 + 1] = v
    },
    cover(i) {
      let p = this.dlink(i)
      while (p !== i) {
        this.hide(p)
        p = this.dlink(p)
      }
      const l = this.llink(i)
      const r = this.rlink(i)
      this.setRlink(l, r)
      this.setLlink(r, l)
    },
    hide(p) {
      let q = p + 1
      while (q !== p) {
        if (q < 0) {
          throw new Error(`Bad q: ${q}`)
        }
        const x = this.top(q)
        const u = this.ulink(q)
        const d = this.dlink(q)
        if (x <= 0) {
          q = u
        } else {
          this.setDlink(u, d)
          this.setUlink(d, u)
          this.setLen(x, this.len(x) - 1)
          q = q + 1
        }
      }
    },
    uncover(i) {
      const l = this.llink(i)
      const r = this.rlink(i)
      this.setRlink(l, i)
      this.setLlink(r, i)
      let p = this.ulink(i)
      while (p != i) {
        this.unhide(p)
        p = this.ulink(p)
      }
    },
    unhide(p) {
      let q = p - 1
      while (q != p) {
        const x = this.top(q)
        const u = this.ulink(q)
        const d = this.dlink(q)
        if (x <= 0) {
          q = d
        } else {
          this.setDlink(u, q)
          this.setUlink(d, q)
          this.setLen(x, this.len(x) + 1)
          q = q - 1
        }
      }
    },
    print() {
      /*
      console.log("Item memory:")
      console.log(JSON.stringify([...mem.slice(0, itemBase)]))
      console.log("Option memory (header):")
      console.log(JSON.stringify([...mem.slice(itemBase, itemBase + (nItems+1) * 3)]))
      console.log("Option memory (rest):")
      console.log(JSON.stringify([...mem.slice(itemBase + (nItems+1) * 3)]))
      */
      const items = []
      let p = this.rlink(0)
      while (p !== 0) {
        items.push(p)
        p = this.rlink(p)
      }
      console.log("Items:\n"+ items.join(""))

      for (let optIdx = nItems + 1; optIdx != lastSpacer;) {
        const lastNode = this.dlink(optIdx)
        let s = ""
        for (let j = optIdx + 1; j <= lastNode; j++) {
          const itemIdx = this.top(j)
          const itemArrayIdx = items.findIndex(i => i === itemIdx)
          if (itemArrayIdx >= 0) {
            while (s.length < itemArrayIdx) {
              s += ' '
            }
            s += 'x'
          } else break
        }
        if (s) console.log(s)
        optIdx = lastNode + 1
      }
        /*
      const optionsSatisfyingItem = items.map(() => new Set)
      items.forEach((i, idx) => {
        let opt = this.dlink(i)
        while (opt !== i) {
          // traverse left to find the option idx
          let j = opt - 1
          while (this.top(j) > 0) j--
          const optIdx = -this.top(j)
          optionsSatisfyingItem[idx].add(j + 1)
          opt = this.dlink(opt)
        }
      })
      console.log(optionsSatisfyingItem)
      */
    },
  }
}

function xc(opts, soln) {
  // D1. Initialize.
  const dlx = initialize(opts)
  const {nItems: N, lastSpacer: Z} = dlx

  const xs = []

  const chooseItem = () => {
    let t = Number.MAX_SAFE_INTEGER
    let best_item
    for (let i = dlx.rlink(0); i != 0; i = dlx.rlink(i)) {
      const l = dlx.len(i)
      if (l < t) {
        t = l
        best_item = i
      }
    }
    return best_item
  }

  function report() {
    function r(k) {
      return String.fromCharCode(k < 10 ? 48 + k : k < 36 ? 97 + k - 10 : k < 62 ? 65 + k - 36 : 42)
    }
    let f = 0, fd = 1
    const position = xs.map((x, l) => {
      const d = dlx.len(dlx.top(x))
      let k = 1
      for (let p = dlx.dlink(dlx.top(x)); p != x; p = dlx.dlink(p)) k++
      fd *= d
      f += (k - 1) / fd
      return `${r(k)}${r(d)}`
    }).join(' ')
    console.log(`${position} (${((f+0.5/fd) * 100).toFixed(5)}%)`)
  }
  let lcnt = 0

  function level(l) {
    lcnt += 1
    if (lcnt % 1000000 === 0) {
      report()
    }
    //console.log()
    //console.log(`=== Level ${l} ===`)
    //console.log()
    //dlx.print()
    if (l > N) throw new Error(`bad l: ${l}`)
    // D2. Enter level l.
    if (dlx.rlink(0) === 0) {
      // solution.
      return soln(xs.map(x => {
        for (let j = x;; j--) {
          const i = dlx.top(j)
          if (i <= 0) return (-i)|0
        }
      }))
    }

    // D3. Choose i.
    let i = chooseItem()
    // D4. Cover i.
    dlx.cover(i)
    //console.log(`Chose ${i}`)
    xs[l] = dlx.dlink(i)

    // D5. Try x_l.
    while (true) {
      if (xs[l] === i) {
        break
      }

      //console.log(`trying option ${xs[l]}`)
      let p = xs[l] + 1
      while (p !== xs[l]) {
        const j = dlx.top(p)
        if (j <= 0) {
          p = dlx.ulink(p)
        } else {
          dlx.cover(j)
          p = p + 1
        }
      }
      //dlx.print()
      level(l+1)
      //console.log(`=== Level ${l} ===`)
      // D6. Try again.
      p = xs[l] - 1
      while (p !== xs[l]) {
        const j = dlx.top(p)
        if (j <= 0) {
          p = dlx.dlink(p)
        } else {
          dlx.uncover(j)
          p = p - 1
        }
      }
      i = dlx.top(xs[l])
      xs[l] = dlx.dlink(xs[l])
    }

    // D7. Backtrack.
    //console.log(`Backtracking, uncovering ${i}`)
    dlx.uncover(i)
    //dlx.print()
    xs.length = l // TODO this is just for reporting, check if it hurts perf
  }
  level(0)
}

const opts = [
  [2, 4],
  [0, 3, 6],
  [1, 2, 5],
  [0, 3, 5],
  [1, 6],
  [3, 4, 6]
]
xc(opts, s => console.log(s.sort().map(x=>opts[x])))

function langfordPairOpts(n) {
  const o = []
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j < 2*n-i; j++) {
      let k = j + i + 1
      o.push([i-1, n+j-1, n+k-1])
    }
  }
  return o
}

const lpopts = langfordPairOpts(3)
console.log(lpopts)
xc(lpopts, s => console.log(s.sort().map(x=>lpopts[x])))
let n = 0
xc(langfordPairOpts(12), s => n++)
console.log(n)

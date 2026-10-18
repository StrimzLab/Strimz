'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { canvasStatus, type CanvasStatus } from '../state'

const VERTEX = `
attribute vec4 a_seed;
uniform float u_time;
uniform vec2 u_sink;
uniform vec2 u_mouse;
uniform vec2 u_size;
uniform float u_dpr;
uniform float u_wide;
varying float v_alpha;
varying float v_heat;

vec2 bezier(vec2 a, vec2 b, vec2 c, vec2 d, float t) {
  float u = 1.0 - t;
  return u*u*u*a + 3.0*u*u*t*b + 3.0*u*t*t*c + t*t*t*d;
}

void main() {
  float id = floor(a_seed.x * 18.0);
  vec2 s;
  if (id < 6.0) {
    s = vec2(0.02 + id * 0.11, -0.06);
  } else if (id < 13.0) {
    s = vec2(-0.06 + (id - 6.0) * 0.1, 1.06);
  } else {
    s = vec2(1.06, 0.06 + (id - 13.0) * 0.22);
  }
  float topLane = step(id, 5.5) * (1.0 - u_wide);

  float speed = 0.05 + 0.05 * fract(id * 0.618) + 0.02 * a_seed.w;
  float t = fract(a_seed.y + u_time * speed);
  float e = 1.0 - pow(1.0 - t, 1.6);

  vec2 p1 = vec2(mix(s.x, u_sink.x, 0.55), s.y);
  vec2 p2 = vec2(mix(s.x, u_sink.x, 0.92), mix(s.y, u_sink.y, 0.72));
  vec2 p = bezier(s, p1, p2, u_sink, e);

  vec2 dir = normalize(u_sink - s);
  vec2 normal = vec2(-dir.y, dir.x);
  p += normal * (a_seed.z - 0.5) * 0.022 * (1.0 - e);
  p += normal * sin(e * 9.0 + id * 2.1 + u_time * 0.6) * 0.008 * (1.0 - e);

  vec2 aspect = vec2(u_size.x / u_size.y, 1.0);
  vec2 away = (p - u_mouse) * aspect;
  float near = exp(-dot(away, away) * 80.0);
  p += normalize(away + 1e-4) / aspect * near * 0.04;

  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);

  float packet = step(0.985, a_seed.w);
  gl_PointSize = (1.6 + a_seed.w * 2.0 + packet * 5.0) * u_dpr * (1.0 - 0.4 * e);
  v_alpha = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.82, 0.97, e)) * (0.45 + 0.55 * a_seed.w) * (1.0 - topLane);
  v_heat = clamp(e * 1.15 + packet, 0.0, 1.0);
}
`

const FRAGMENT = `
precision mediump float;
uniform float u_light;
varying float v_alpha;
varying float v_heat;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float disc = smoothstep(0.5, 0.0, d);
  vec3 mint = vec3(0.584, 0.996, 0.8);
  vec3 green = vec3(0.008, 0.78, 0.416);
  vec3 deep = vec3(0.0, 0.47, 0.25);
  vec3 color = mix(mix(green, mint, v_heat), mix(deep, green, v_heat), u_light);
  float a = disc * v_alpha * mix(1.0, 0.8, u_light);
  gl_FragColor = vec4(color * a, a);
}
`

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('could not create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'shader failed to compile')
  }
  return shader
}

function seeds(count: number): Float32Array {
  const data = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    data[i * 4] = Math.random()
    data[i * 4 + 1] = Math.random()
    data[i * 4 + 2] = Math.random()
    data[i * 4 + 3] = Math.random()
  }
  return data
}

/** Payments as particles, streaming into whatever `sinkRef` points at. Decorative; the hero reads fine without it. */
export function StreamField({ sinkRef }: { sinkRef: RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<CanvasStatus>('loading')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: true })
    const report = (phase: 'running' | 'failed') =>
      setStatus(canvasStatus({ phase, webgl: gl !== null, reducedMotion: still }))
    if (!gl) {
      report('running')
      return
    }
    const count = window.matchMedia('(min-width: 1024px)').matches ? 12000 : 4000

    let program: WebGLProgram | null = null
    let buffer: WebGLBuffer | null = null
    let frame = 0
    let visible = true
    const start = performance.now()
    const mouse = { x: -1, y: -1, tx: -1, ty: -1 }
    const sink = { x: 0.75, y: 0.5 }
    const root = document.documentElement
    let light = !root.classList.contains('dark')
    let uniforms: Record<string, WebGLUniformLocation | null> = {}

    const setup = () => {
      const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
      program = gl.createProgram()
      if (!program) throw new Error('could not create program')
      gl.attachShader(program, vs)
      gl.attachShader(program, fs)
      gl.linkProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.useProgram(program)

      buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, seeds(count), gl.STATIC_DRAW)
      const loc = gl.getAttribLocation(program, 'a_seed')
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0)

      uniforms = Object.fromEntries(
        ['u_time', 'u_sink', 'u_mouse', 'u_size', 'u_dpr', 'u_wide', 'u_light'].map((n) => [
          n,
          gl.getUniformLocation(program as WebGLProgram, n),
        ]),
      )
      gl.enable(gl.BLEND)
      gl.clearColor(0, 0, 0, 0)
    }

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      gl.viewport(0, 0, canvas.width, canvas.height)
      const target = sinkRef.current?.getBoundingClientRect()
      if (target && rect.width > 0) {
        sink.x = (target.left + target.width * 0.5 - rect.left) / rect.width
        sink.y = (target.top + target.height * 0.45 - rect.top) / rect.height
      }
      return dpr
    }

    let dpr = 1
    const draw = (now: number) => {
      if (!program) return
      mouse.x += (mouse.tx - mouse.x) * 0.08
      mouse.y += (mouse.ty - mouse.y) * 0.08
      gl.clear(gl.COLOR_BUFFER_BIT)
      // Additive light washes out to white on a pale stage, so light mode layers normally.
      gl.blendFunc(gl.ONE, light ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE)
      gl.uniform1f(uniforms.u_light ?? null, light ? 1 : 0)
      gl.uniform1f(uniforms.u_time ?? null, still ? 9 : (now - start) / 1000)
      gl.uniform2f(uniforms.u_sink ?? null, sink.x, sink.y)
      gl.uniform2f(uniforms.u_mouse ?? null, mouse.x, mouse.y)
      gl.uniform2f(uniforms.u_size ?? null, canvas.width, canvas.height)
      gl.uniform1f(uniforms.u_dpr ?? null, dpr)
      gl.uniform1f(uniforms.u_wide ?? null, canvas.width > canvas.height ? 1 : 0)
      gl.drawArrays(gl.POINTS, 0, count)
    }

    const loop = (now: number) => {
      draw(now)
      frame = visible && !document.hidden ? requestAnimationFrame(loop) : 0
    }
    const resume = () => {
      if (still || frame || !visible || document.hidden) return
      frame = requestAnimationFrame(loop)
    }

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const rect = canvas.getBoundingClientRect()
      mouse.tx = (e.clientX - rect.left) / rect.width
      mouse.ty = (e.clientY - rect.top) / rect.height
    }
    const onLeave = () => {
      mouse.tx = -1
      mouse.ty = -1
    }
    const onLost = (e: Event) => {
      e.preventDefault()
      cancelAnimationFrame(frame)
      frame = 0
      program = null
      report('failed')
    }
    const onRestored = () => {
      setup()
      dpr = measure()
      report('running')
      if (still) draw(0)
      else resume()
    }

    try {
      setup()
    } catch (error) {
      console.error('[hero] the payment stream canvas failed to start', error)
      report('failed')
      return
    }
    dpr = measure()
    report('running')

    const resize = new ResizeObserver(() => {
      dpr = measure()
      if (still) draw(0)
    })
    resize.observe(canvas)
    const view = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      resume()
    })
    view.observe(canvas)
    const onVisibility = () => resume()
    const theme = new MutationObserver(() => {
      light = !root.classList.contains('dark')
      if (still) draw(0)
    })
    theme.observe(root, { attributes: true, attributeFilter: ['class'] })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pointermove', onPointer, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)

    if (still) draw(0)
    else resume()

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      view.disconnect()
      theme.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onPointer)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      if (buffer) gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
    }
  }, [sinkRef])

  const drawing = status === 'live' || status === 'still'
  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        data-status={status}
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-1000 [mask-image:linear-gradient(to_bottom,black_calc(100%-150px),transparent_calc(100%-40px))] ${drawing ? 'opacity-100' : 'opacity-0'}`}
      />
      {status === 'unsupported' || status === 'error' ? (
        <div
          aria-hidden
          data-poster
          className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_75%_50%,rgb(2_199_106/0.22),transparent_70%),repeating-linear-gradient(115deg,transparent_0_46px,rgb(149_254_204/0.05)_46px_47px)]"
        />
      ) : null}
    </>
  )
}

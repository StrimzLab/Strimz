export type OdometerCell = { kind: 'digit'; value: number } | { kind: 'static'; char: string }

export function odometerCells(text: string): OdometerCell[] {
  return [...text].map((char) =>
    /\d/.test(char) ? { kind: 'digit', value: Number(char) } : { kind: 'static', char },
  )
}

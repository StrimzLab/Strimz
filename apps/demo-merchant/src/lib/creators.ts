export interface Creator {
  handle: string
  name: string
  craft: string
  city: string
  hue: number
}

export const FIRST_CREATOR: Creator = {
  handle: 'temi.keys',
  name: 'Temi Adebayo',
  craft: 'Afro-soul keys',
  city: 'Lagos',
  hue: 340,
}

export const CREATORS: Creator[] = [
  FIRST_CREATOR,
  {
    handle: 'kwame.laughs',
    name: 'Kwame Mensah',
    craft: 'Stand-up comedy',
    city: 'Accra',
    hue: 38,
  },
  {
    handle: 'wanjiku.pod',
    name: 'Wanjiku Kamau',
    craft: 'Tech podcast',
    city: 'Nairobi',
    hue: 160,
  },
  {
    handle: 'amani.beats',
    name: 'Amani Mushi',
    craft: 'Bongo Flava producer',
    city: 'Dar es Salaam',
    hue: 265,
  },
]

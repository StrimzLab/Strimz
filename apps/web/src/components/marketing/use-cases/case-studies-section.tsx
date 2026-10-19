import { CASE_STUDIES, namedCaseStudies } from './case-studies'

export function CaseStudiesSection() {
  const studies = namedCaseStudies(CASE_STUDIES)
  if (studies.length === 0) return null
  return (
    <section aria-labelledby="case-studies-title" className="py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
        <h2
          id="case-studies-title"
          className="font-sora text-foreground text-[34px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[48px]"
        >
          What merchants say.
        </h2>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {studies.map((s) => (
            <figure key={s.name} className="border-border bg-card rounded-[22px] border p-7">
              <blockquote className="font-poppins text-foreground text-base leading-relaxed">
                &ldquo;{s.quote}&rdquo;
              </blockquote>
              <figcaption className="border-border mt-6 border-t pt-4">
                <p className="font-poppins text-foreground text-sm font-semibold">{s.name}</p>
                <p className="font-poppins text-muted-foreground mt-0.5 text-xs">
                  {s.role}, {s.company}. {s.sector}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

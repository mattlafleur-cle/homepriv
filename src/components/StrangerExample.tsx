import Image, { type StaticImageData } from "next/image";
import exterior from "@/assets/example/exterior.jpg";
import livingRoom from "@/assets/example/living-room.jpg";
import bedroom from "@/assets/example/bedroom.jpg";
import bathroom from "@/assets/example/bathroom.jpg";
import basement from "@/assets/example/basement.jpg";

/**
 * "What a stranger can learn" example. Licensed stock photos of a home that is
 * not a customer's; the house number and yard sign are blurred in the files.
 * Every callout must point at something actually visible in its photo.
 */

type Marker = { n: number; x: number; y: number };

const CALLOUTS: { n: number; text: string }[] = [
  { n: 1, text: "The house itself, on the same page as its street address." },
  { n: 2, text: "The front entry, as seen from the street." },
  { n: 3, text: "The TV and electronics, and where they sit." },
  { n: 4, text: "A glass door to the back of the house." },
  { n: 5, text: "Sliding glass doors from the primary bedroom to a deck." },
  { n: 6, text: "How the primary bath and bedroom connect." },
  { n: 7, text: "A computer workstation in the basement." },
  { n: 8, text: "Basement windows at ground level." },
  { n: 9, text: "Every room and every outside door, on one drawing." },
];

function Pin({ n, x, y }: Marker) {
  return (
    <span
      aria-hidden="true"
      className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-clay-ink text-[0.8rem] font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.45)] ring-2 ring-white sm:h-8 sm:w-8 sm:text-[0.875rem]"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {n}
    </span>
  );
}

function Photo({
  src,
  alt,
  label,
  markers,
  sizes,
  className = "",
}: {
  src: StaticImageData;
  alt: string;
  label: string;
  markers: Marker[];
  sizes: string;
  className?: string;
}) {
  return (
    <figure className={`relative overflow-hidden rounded-xl bg-sand ${className}`}>
      <Image src={src} alt={alt} sizes={sizes} placeholder="blur" className="h-full w-full object-cover" />
      {markers.map((m) => (
        <Pin key={m.n} {...m} />
      ))}
      <figcaption className="absolute bottom-2 left-2 rounded-md bg-ink/80 px-2 py-0.5 text-[0.75rem] font-semibold text-white">
        {label}
      </figcaption>
    </figure>
  );
}

function FloorPlan() {
  const door = "#8a4421";
  return (
    <figure className="relative overflow-hidden rounded-xl border border-line bg-paper">
      <svg
        viewBox="0 0 400 266"
        className="h-full w-full"
        role="img"
        aria-label="Illustrative floor plan showing a garage, living room, kitchen, primary bedroom and bath, a second bedroom, and four outside doors highlighted"
      >
        <g fill="none" stroke="#1c2623" strokeWidth="4">
          <rect x="20" y="20" width="360" height="200" />
        </g>
        <g fill="none" stroke="#1c2623" strokeWidth="2">
          <line x1="130" y1="20" x2="130" y2="220" />
          <line x1="20" y1="130" x2="130" y2="130" />
          <line x1="250" y1="20" x2="250" y2="220" />
          <line x1="130" y1="120" x2="250" y2="120" />
          <line x1="250" y1="90" x2="380" y2="90" />
        </g>
        <g fontFamily="Inter Variable, sans-serif" fontSize="12" fill="#4c5a55" textAnchor="middle">
          <text x="75" y="78">Garage</text>
          <text x="75" y="178">Bedroom 2</text>
          <text x="190" y="72">Living</text>
          <text x="190" y="172">Kitchen</text>
          <text x="315" y="58">Primary bath</text>
          <text x="315" y="150">Primary</text>
          <text x="315" y="165">bedroom</text>
        </g>
        <g stroke={door} strokeWidth="7" strokeLinecap="round">
          <line x1="165" y1="20" x2="195" y2="20" />
          <line x1="160" y1="220" x2="185" y2="220" />
          <line x1="380" y1="110" x2="380" y2="150" />
          <line x1="45" y1="20" x2="105" y2="20" />
        </g>
        <g fontFamily="Inter Variable, sans-serif" fontSize="11" fontWeight="600" fill={door} textAnchor="middle">
          <text x="180" y="13">Front door</text>
          <text x="172" y="238">Rear glass door</text>
          <text x="75" y="13">Garage door</text>
          <text x="363" y="240">Deck door</text>
        </g>
      </svg>
      <Pin n={9} x={50} y={50} />
      <figcaption className="absolute bottom-2 left-2 rounded-md bg-ink/80 px-2 py-0.5 text-[0.75rem] font-semibold text-white">
        Floor plan
      </figcaption>
    </figure>
  );
}

export function StrangerExample() {
  return (
    <section aria-labelledby="stranger-title">
      <div className="container-page py-16 md:py-24">
        <div className="max-w-3xl">
          <p className="eyebrow">An example listing</p>
          <h2 id="stranger-title" className="mt-3 text-[2rem] font-medium sm:text-[2.5rem]">
            What a stranger can learn from an old listing.
          </h2>
          <p className="mt-5 text-[1.1rem] text-muted">
            Listing photos are taken to sell a house, so they show all of it, room by room. After the sale, the same gallery can
            stay a search away from the address. This is what a typical one shows.
          </p>
        </div>

        <div className="mt-10 rounded-[var(--radius-card)] border border-line bg-paper p-3 shadow-[0_24px_60px_-40px_rgba(31,74,61,0.55)] sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-sage px-2.5 py-0.5 text-[0.8rem] font-semibold text-evergreen">Off market</span>
              <span className="text-[0.9rem] font-semibold text-ink">Photo gallery still public</span>
            </div>
            <span className="text-[0.85rem] text-muted">Example property page</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
            <Photo
              src={exterior}
              alt="Front of a two-story brick house with a two-car garage, front porch, and yard sign. The house number and sign are blurred."
              label="Exterior"
              markers={[
                { n: 1, x: 61, y: 55.5 },
                { n: 2, x: 53, y: 64 },
              ]}
              sizes="(min-width: 1024px) 760px, 100vw"
              className="col-span-2 aspect-[3/2] lg:row-span-2 lg:aspect-auto"
            />
            <Photo
              src={livingRoom}
              alt="Living room with a wall-mounted TV, fireplace, and a glass door to the backyard"
              label="Living room"
              markers={[
                { n: 3, x: 80, y: 40 },
                { n: 4, x: 39.5, y: 52 },
              ]}
              sizes="(min-width: 1024px) 380px, 50vw"
              className="aspect-[3/2]"
            />
            <Photo
              src={bedroom}
              alt="Primary bedroom with a king bed and sliding glass doors to a deck"
              label="Primary bedroom"
              markers={[{ n: 5, x: 87, y: 45 }]}
              sizes="(min-width: 1024px) 380px, 50vw"
              className="aspect-[3/2]"
            />
            <Photo
              src={bathroom}
              alt="Primary bathroom with a soaking tub and glass shower, and an open door into the bedroom"
              label="Primary bath"
              markers={[{ n: 6, x: 50, y: 50 }]}
              sizes="(min-width: 1024px) 380px, 50vw"
              className="aspect-[3/2]"
            />
            <Photo
              src={basement}
              alt="Finished basement with a staircase, ground-level windows, storage cabinets, and a computer desk"
              label="Basement"
              markers={[
                { n: 7, x: 84.5, y: 46 },
                { n: 8, x: 12, y: 18 },
              ]}
              sizes="(min-width: 1024px) 380px, 50vw"
              className="aspect-[3/2]"
            />
            <div className="col-span-2 lg:col-span-1">
              <FloorPlan />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          <ol className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {CALLOUTS.map((c) => (
              <li key={c.n} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-clay-ink text-[0.8rem] font-bold text-white"
                >
                  {c.n}
                </span>
                <span>{c.text}</span>
              </li>
            ))}
          </ol>
          <div className="space-y-4 text-muted">
            <p className="text-[1.1rem] text-ink">
              Someone who has been inside your home knows some of this. A public listing shows all of it to anyone who looks up
              the address, for as long as the photos stay up.
            </p>
            <p className="text-[0.9rem]">
              Example home using licensed stock photos. It is not a customer&apos;s home. We blurred the house number and yard
              sign. The floor plan is an illustration.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

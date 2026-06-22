import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Mic, X } from "lucide-react";
import { usePepper } from "@/pepper";

/**
 * The guided-tour banner. Rendered globally (inside the router, alongside the
 * GlobalAssistant) so it persists across page changes — including the
 * full-screen demo takeover routes (/market, /financing, /capital-markets)
 * where the "Hey Pep" overlay is intentionally suppressed.
 *
 * The provider owns the tour DATA (ordered stops + current index); this
 * component is the only place that touches navigation, because the provider
 * lives OUTSIDE the wouter Router and cannot use its hooks. As the current stop
 * changes, it navigates there. The Next control and a press-to-talk mic advance
 * or end the tour; saying "next"/"stop" works on any page (the overlay isn't
 * available on the demo routes, so the banner carries its own mic).
 */
export function TourBanner() {
  const { tour, tourNext, tourStop, dictateStart, dictateStop, dictating, setOpen } =
    usePepper();
  const [, setLocation] = useLocation();

  const current = tour ? tour.stops[tour.index] : null;
  const route = current?.route;

  // Navigate to the current stop whenever it changes (including on tour start
  // and on every Next). Close the chat panel at the same time so the demo
  // screen beneath is actually visible — the tour reveals the real route with
  // only this floating banner over it, never the chat conversation covering it.
  useEffect(() => {
    if (route) {
      setOpen(false);
      setLocation(route);
    }
  }, [route, setLocation, setOpen]);

  if (!tour || !current) return null;

  const total = tour.stops.length;
  const position = tour.index + 1;

  const onMic = async () => {
    if (dictating) {
      const text = (await dictateStop()).toLowerCase();
      if (/\b(stop|end|exit|finish|done|quit)\b/.test(text)) {
        tourStop();
      } else if (/\b(next|continue|forward|keep going|go on|onward)\b/.test(text)) {
        tourNext();
      }
    } else {
      await dictateStart();
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] w-[min(640px,calc(100%-1.5rem))]">
      <div className="rounded-2xl border border-[rgba(255,180,120,.22)] bg-[#171210]/95 text-[#f6ece1] shadow-[0_12px_40px_rgba(0,0,0,.5)] backdrop-blur-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#ff7e3f] shadow-[0_0_10px_rgba(255,126,63,.7)]" />
            Pepper tour
          </span>
          <span className="text-sm text-[#f6ece1]/80 truncate">
            {current.name}
          </span>
          <span className="text-xs text-[#a8978a] tabular-nums">
            ({position}/{total})
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={onMic}
              aria-label={dictating ? "Listening — say next or stop" : "Speak"}
              className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-colors ${
                dictating
                  ? "bg-[#ff7e3f] text-white border-transparent"
                  : "border-[rgba(255,180,120,.25)] text-[#ff7e3f] hover:bg-[rgba(255,126,63,.12)]"
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={tourNext}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#ff7e3f] text-white text-sm font-medium px-3.5 h-9 hover:bg-[#ff8f57] transition-colors"
            >
              {position >= total ? "Finish" : "Next"}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={tourStop}
              aria-label="Stop the tour"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[rgba(255,180,120,.25)] text-[#a8978a] hover:text-[#f6ece1] hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-sm text-[#a8978a] leading-snug">
          {current.intro}
        </p>
      </div>
    </div>
  );
}

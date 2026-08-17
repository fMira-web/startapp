import Reveal from '../Reveal';
import FeatureToggleCard from './FeatureToggleCard';
import QuantitySelector from './QuantitySelector';
import TierSelector from './TierSelector';

export default function ModuleSection({ section }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-heading`} className="mt-20 sm:mt-28">
      <Reveal>
        <div className="flex flex-col gap-3 border-t border-line pt-8">
          <p className="label-caps">{section.label}</p>
          <h2
            id={`${section.id}-heading`}
            className="text-[1.75rem] font-semibold tracking-[-0.025em] text-ink sm:text-[2rem]"
          >
            {section.title}
          </h2>
          <p className="measure text-[1.0625rem] leading-relaxed text-ink-muted">
            {section.description}
          </p>
        </div>
      </Reveal>

      <div className="mt-8">
        {section.kind === 'toggles' && (
          <div className="flex flex-col gap-4">
            {section.items.map((item, index) => (
              <Reveal key={item.id} delay={Math.min(index * 0.04, 0.16)} y={12}>
                <FeatureToggleCard item={item} />
              </Reveal>
            ))}
          </div>
        )}

        {section.kind === 'quantities' && (
          <div className="flex flex-col gap-4">
            {section.items.map((item, index) => (
              <Reveal key={item.id} delay={Math.min(index * 0.04, 0.16)} y={12}>
                <QuantitySelector item={item} />
              </Reveal>
            ))}
          </div>
        )}

        {section.kind === 'tier' && (
          <Reveal y={12}>
            <TierSelector section={section} />
          </Reveal>
        )}
      </div>
    </section>
  );
}

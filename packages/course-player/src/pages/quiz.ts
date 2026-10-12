import type { Course, PageOfType } from '@gamatutor/course-schema';
import { statement } from '@gamatutor/tracking';
import type { RenderContext } from '../context.js';
import { cardShell, setCard, wireFooterNav } from '../chrome/shell.js';
import { esc } from '../dom.js';

type QuizPage = PageOfType<'quiz'>;

/** Quiz pages in course order — the original carried this as index/total. */
export function quizPages(course: Course): QuizPage[] {
  return course.modules.flatMap((m) => m.pages).filter((p): p is QuizPage => p.type === 'quiz');
}

export function renderQuiz(ctx: RenderContext, page: QuizPage): void {
  const chosen = ctx.state.quizAnswers[page.id];
  const answered = !!chosen;

  const all = quizPages(ctx.course);
  const index = all.findIndex((p) => p.id === page.id);
  const total = all.length;

  const optionsHtml = page.options
    .map((o) => {
      let cls = 'opt-row';
      if (answered) {
        cls += ' disabled';
        if (o.letter === page.correct) cls += ' correct';
        else if (o.letter === chosen) cls += ' wrong';
      }
      return `<label class="${cls}" data-letter="${o.letter}">
      <input type="radio" name="qopt" ${answered ? 'disabled' : ''} ${chosen === o.letter ? 'checked' : ''}>
      <span class="letter">${o.letter}.</span> ${esc(o.text)}
    </label>`;
    })
    .join('');

  const body = `
    <div class="quiz-tag">Soal ${index + 1} dari ${total}${page.tag ? ` &middot; ${esc(page.tag)}` : ''}</div>
    <p class="quiz-question">${esc(page.question)}</p>
    ${answered ? '' : '<p class="page-instruction">Pilih satu jawaban, lalu klik Submit.</p>'}
    <div class="opt-list" id="quizOptList">${optionsHtml}</div>
    <button class="submit-btn" id="quizSubmitBtn" ${answered ? 'disabled' : ''}>Submit</button>
    <div class="reasoning-box${answered && chosen !== page.correct ? ' is-wrong' : ''}" role="status" style="display:${answered ? 'block' : 'none'}">
      <b>${answered && chosen === page.correct ? '&#10003; Benar.' : '&#10007; Kurang tepat.'}</b>
      Jawaban yang benar: <b>${esc(page.correct)}</b>. ${esc(page.explanation)}
    </div>
  `;
  setCard(ctx, cardShell(ctx, body));
  wireFooterNav(ctx);

  let picked: string | null = chosen || null;
  if (!answered) {
    ctx.document.querySelectorAll<HTMLElement>('#quizOptList .opt-row').forEach((row) => {
      row.onclick = () => {
        picked = row.dataset['letter'] ?? null;
        ctx.document
          .querySelectorAll<HTMLInputElement>('#quizOptList .opt-row input')
          .forEach((inp) => {
            inp.checked =
              (inp.closest('.opt-row') as HTMLElement | null)?.dataset['letter'] === picked;
          });
      };
    });
    const submit = ctx.document.getElementById('quizSubmitBtn');
    if (submit) {
      submit.onclick = () => {
        if (!picked) return;
        ctx.state.quizAnswers[page.id] = picked;
        ctx.adapter.emit(
          statement('answered', page.id, {
            result: { response: picked, success: picked === page.correct },
          }),
        );
        ctx.rerender();
      };
    }
  }
}

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Cyberdoc delivery association and completion use server-only transactional RPCs keyed by the order UUID; row locks keep stock, audit and notification effects atomic under retries and concurrent manual completion.
- Document generation is committed before automatic completion; failed completion returns the saved delivery and supports retry without generating another document.

import { getSession } from '@/lib/composition';
import { createSessionStream, SSE_HEADERS } from '@/lib/http/sessionStream';

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const session = getSession(id);

    if (!session) {
      return Response.json({ message: 'Session not found' }, { status: 404 });
    }

    const { readable } = createSessionStream(session, req.signal);
    return new Response(readable, { headers: SSE_HEADERS });
  } catch (err) {
    console.error('Error in reconnecting to session stream: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

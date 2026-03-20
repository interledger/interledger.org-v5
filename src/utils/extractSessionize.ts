import type { Talk, Speaker, SessionizeSpeaker } from '@/types/summit'

export async function getSpeakers(
  year: string,
  articleId?: string
): Promise<Speaker[]> {
  const data = await import(`../data/sessionize/${year}-speakers.json`)
  if (!data) return []

  // Question ID for Spanish bio in Sessionize
  const SPANISH_BIO_QUESTION_ID = 114100
  const speakers: Speaker[] = data.default.map((speaker: SessionizeSpeaker) => {
    const sessions = speaker.sessions.map((session) => ({
      id: String(session.id),
      title: session.name
    }))

    const spanishBioAnswer = speaker.questionAnswers.find(
      (q) => q.id === SPANISH_BIO_QUESTION_ID
    )
    const spanishBio = spanishBioAnswer?.answer
    return {
      id: speaker.id,
      name: speaker.fullName,
      bio: speaker.bio,
      tagLine: speaker.tagLine,
      profilePicture: speaker.profilePicture,
      es: spanishBio ? { bio: spanishBio } : null,
      sessions
    }
  })

  if (articleId) {
    return speakers.filter((speaker) => {
      return speaker.sessions.some((session) => session.id === articleId)
    })
  }

  return speakers
}
//TODO: Dummy function - ignore this for now, will be implemented in a follow up PR
export function getTalks(year: string, authorId?: string): Talk[] {
  const baseSessions: Talk[] = [
    {
      id: '995871',
      title:
        'Human Rights by Design: Financial Infrastructure that Works for Everyone',
      description:
        "As digital public infrastructure becomes the backbone of global financial systems, we stand at a critical juncture: will these foundational technologies amplify existing inequalities or become engines of inclusion? This panel will examine how human rights principles can be operationalized within digital public financial infrastructure. Drawing on expertise from financial inclusion, digital public infrastructure development, and racial justice advocacy, the discussion will tackle critical questions: How do global human rights norms translate into technical specifications? Where do implementation challenges most often derail good intentions? What does it look like when justice isn't an afterthought but a core design principle? And critically, who gets to make these decisions, and how do we ensure those most affected have a voice in shaping the systems that will serve them?",
      startsAt: '2025-11-05T11:30:00',
      endsAt: '2025-11-05T12:30:00',
      speakers: [
        {
          id: 'd55a0ff7-8857-4713-96a3-3898a61d0de6',
          name: 'Ayden Férdeline'
        },
        {
          id: 'ad2c458b-64a4-401b-aa98-05944bb9f7dd',
          name: 'Ed Cable'
        }
      ],
      translations: ['English', 'Spanish Translation available'],
      es: {
        title:
          'Derechos humanos por diseño: una infraestructura financiera que funciona para todos',
        description:
          'A medida que la infraestructura pública digital se convierte en la columna vertebral de los sistemas financieros mundiales, nos encontramos en una encrucijada crítica: ¿estas tecnologías fundamentales amplificarán las desigualdades existentes o se convertirán en motores de inclusión? Este panel examinará cómo se pueden poner en práctica los principios de derechos humanos dentro de la infraestructura financiera pública digital. Aprovechando la experiencia en materia de inclusión financiera, desarrollo de infraestructura pública digital y defensa de la justicia racial, el debate abordará cuestiones fundamentales como: ¿Cómo se traducen las normas mundiales de derechos humanos en especificaciones técnicas? ¿Dónde suelen frustrar los retos de implementación las buenas intenciones? ¿Cómo es cuando la justicia no es una idea secundaria, sino un principio básico del diseño? Y, lo que es más importante, ¿quién toma estas decisiones y cómo garantizamos que los más afectados tengan voz en la configuración de los sistemas que les servirán?'
      }
    },
    {
      id: '1033766',
      title:
        'Enabling Banks in Pakistan to offer faster, cost-effective remittance services via ILP',
      description:
        "Paysys Labs, a leading fintech company known for its innovative digital payment and financial service solutions, is partnering with Allied Bank Limited to transform the remittance landscape in Pakistan. Banks in Pakistan currently face challenges such as high costs and delays in cross-border payments, which impact customer satisfaction. This arrangement will enable ABL to offer faster, more cost-effective remittance services, enhancing customer experience and expanding financial inclusion in Pakistan.\r\n\r\nThis project aims to revolutionize cross-border payments by integrating ABL into the global Interledger Protocol  network through the implementation of Open Connect Middleware by Paysys Labs. This will establish ABL's node on the ILP network, allowing customer accounts to function as digital wallets within the ILP ecosystem.",
      startsAt: '2025-11-05T11:55:00',
      endsAt: '2025-11-05T12:15:00',
      speakers: [
        {
          id: '58ec7ac2-d517-43a8-a12c-e73a381735da',
          name: 'Karim Jindani'
        }
      ],
      translations: ['English'],
      es: {
        title:
          'Acompañando a los bancos de Pakistán para ofrecer servicios de envío de remesas más rápidos y rentables a través de ILP.',
        description:
          'Paysys Labs, una empresa líder en tecnología financiera conocida por sus innovadoras soluciones de pago digital y servicios financieros, se ha asociado con Allied Bank Limited para transformar el panorama de las remesas en Pakistán. Los bancos de Pakistán se enfrentan actualmente a retos como los altos costes y los retrasos en los pagos transfronterizos, lo que repercute en la satisfacción de los clientes. Este acuerdo permitirá a ABL ofrecer servicios de remesas más rápidos y rentables, mejorando la experiencia del cliente y ampliando la inclusión financiera en Pakistán.\r\nEste proyecto tiene como objetivo revolucionar los pagos transfronterizos mediante la integración de ABL en la red global Interledger Protocol  a través de la implementación de Open Connect Middleware por parte de Paysys Labs. Esto establecerá el nodo de ABL en la red ILP, lo que permitirá que las cuentas de los clientes funcionen como monederos digitales dentro del ecosistema ILP.\r\n\r\nDetalles de la sesión: En este taller trataremos los siguientes temas: -Las necesidades de los clientes y los retos actuales a la hora de recibir remesas en Pakistán. -Requisitos de cumplimiento normativo (KYC-AML-CFT para remesas entrantes en Pakistán). -Una demostración de cómo recibir remesas a través de ILP.\r\n'
      }
    }
  ]

  if (authorId) {
    return baseSessions.filter((session) =>
      session.speakers.some((speaker) => speaker.id === authorId)
    )
  }

  switch (year) {
    case '2022':
      return Array.from({ length: 10 }).flatMap(() => baseSessions)
    case '2023':
      return Array.from({ length: 3 }).flatMap(() => baseSessions)
    case '2024':
      return Array.from({ length: 4 }).flatMap(() => baseSessions)
    case '2025':
      return Array.from({ length: 7 }).flatMap(() => baseSessions)
    default:
      console.error(
        'Year is not correct or sessions data is not available for that year'
      )
      return []
  }
}

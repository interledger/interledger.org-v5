import type { Talk, Speaker } from '@/types/summit'

//Dummy function - ignore this for now, will be implemented in a follow up PR
export function getSpeakers(year: string, articleId?: string): Speaker[] {
  const baseSpeakers: Speaker[] = [
    {
      id: 'd55a0ff7-8857-4713-96a3-3898a61d0de6',
      name: 'Ayden Férdeline',
      bio: 'Ayden Férdeline is Lead, Public Policy and Government Affairs at the Interledger Foundation, where he advances digital financial inclusion by advocating for equitable access to digital public infrastructure. He ensures the Foundation’s perspective is well represented within intergovernmental and multistakeholder fora, and is the point of contact for policymakers, lawmakers, and regulators.  \r\nPrior to joining the Interledger Foundation, he was a Landecker Democracy Fellow with the Alfred Landecker Foundation in collaboration with Humanity in Action. In this role, he ensured the voice of workers, trade unions, and labor organizing groups was understood in different multilateral fora. Previously, he was the lead rapporteur of the Working Group on Pluralism of Information in Curation and Indexation Algorithms at the Forum on Information and Democracy, where he contributed to global discussions on algorithmic governance and the integrity of digital information ecosystems. In addition, he was a technology policy fellow at the Mozilla Foundation, researching the development and harmonization of privacy and data protection laws worldwide, and he represented European civil society organizations on the Council of ICANN’s Generic Names Supporting Organization, the policymaking body responsible for setting binding rules for generic top-level domains such as .COM and .ORG.\r\nBefore entering philanthropy, as an independent consultant he conducted qualitative research on the impact of the Internet on society for organizations including Coworker.org, the National Democratic Institute, and the National Endowment for Democracy.\r\nHe is an alumnus of the London School of Economics and Political Science.',
      tagLine: 'Interledger Foundation',
      profilePicture:
        'https://sessionize.com/image/05c5-400o400o1-QXPc4v8QhzKU5nBbHdDMW.jpg',
      es: {
        bio: 'Ayden Férdeline es directora de Políticas Públicas y Asuntos Gubernamentales de la Fundación Interledger, donde promueve la inclusión financiera digital abogando por un acceso equitativo a la infraestructura pública digital. Se asegura de que la perspectiva de la Fundación esté bien representada en los foros intergubernamentales y multiactores, y es el punto de contacto para los responsables políticos, los legisladores y los reguladores. Antes de incorporarse a la Fundación Interledger, fue becaria Landecker Democracy Fellow de la Fundación Alfred Landecker en colaboración con Humanity in Action. En este cargo, se aseguró de que la voz de los trabajadores, los sindicatos y los grupos de organización laboral se entendiera en diferentes foros multilaterales. Anteriormente, fue relator principal del Grupo de Trabajo sobre Pluralismo de la Información en Algoritmos de Curación e Indexación del Foro sobre Información y Democracia, donde contribuyó a los debates mundiales sobre la gobernanza algorítmica y la integridad de los ecosistemas de información digital. Además, fue becaria de política tecnológica en la Fundación Mozilla, donde investigó el desarrollo y la armonización de las leyes de privacidad y protección de datos en todo el mundo, y representó a las organizaciones de la sociedad civil europea en el Consejo de la Organización de Apoyo a los Nombres Genéricos de la ICANN, el órgano normativo responsable de establecer normas vinculantes para los dominios genéricos de nivel superior, como .COM y .ORG. \r\nAntes de dedicarse a la filantropía, trabajó como consultora independiente realizando investigaciones cualitativas sobre el impacto de Internet en la sociedad para organizaciones como Coworker.org, el Instituto Nacional Demócrata y la Fundación Nacional para la Democracia. Es ex alumna de la London School of Economics and Political Science.\r\n'
      },
      sessions: [
        {
          id: '995871',
          title:
            'Human Rights by Design: Financial Infrastructure that Works for Everyone'
        }
      ]
    },
    {
      id: 'ad2c458b-64a4-401b-aa98-05944bb9f7dd',
      name: 'Ed Cable',
      bio: 'Edward Cable is the President and CEO of the Mifos Initiative, and a founding member of the Apache Fineract PMC. He is a recognized leader in technology-enabled financial inclusion and open service financial services innovation. Edward has been deeply involved in open source fintech solutions since 2007, particularly for emerging markets, and leads the Mifos Initiative in its mission to build innovative financial services with open-source tools. He is passionate about community-driven financial inclusion and oversees a global ecosystem of fintechs and financial institutions. Outside of work, Edward tends to his menagerie of animals in the majestic Redwoods.',
      tagLine: 'Mifos Initiative',
      profilePicture:
        'https://sessionize.com/image/0f26-400o400o1-BjYufp23D8atM3U3ZM8BGM.jpg',
      es: {
        bio: 'Edward Cable es presidente y director ejecutivo de Mifos Initiative, y miembro fundador de Apache Fineract PMC. Es un reconocido líder en inclusión financiera basada en la tecnología e innovación en servicios financieros abiertos. Edward lleva desde 2007 profundamente involucrado en soluciones fintech de código abierto, especialmente para mercados emergentes, y lidera la Iniciativa Mifos en su misión de crear servicios financieros innovadores con herramientas de código abierto. Es un apasionado de la inclusión financiera impulsada por la comunidad y supervisa un ecosistema global de fintechs e instituciones financieras. Fuera del trabajo, Edward se dedica a cuidar de su colección de animales en los majestuosos bosques Redwoods.'
      },
      sessions: [
        {
          id: '995871',
          title:
            'Human Rights by Design: Financial Infrastructure that Works for Everyone'
        }
      ]
    },
    {
      id: '58ec7ac2-d517-43a8-a12c-e73a381735da',
      name: 'Karim Jindani',
      bio: '23+ years of experience in Digital Financial services domain, worked with multiple Central banks, Payment system operators. Workstream lead for Merchant payments in Mojaloop community',
      tagLine: 'CEO at Paysys Labs Pvt Ltd',
      profilePicture:
        'https://sessionize.com/image/15fc-400o400o1-NhFFMTQm52U7irTe9XzzX2.jpg',
      es: {
        bio: 'Más de 23 años de experiencia en el ámbito de los servicios financieros digitales, ha trabajado con múltiples bancos centrales y operadores de sistemas de pago. Responsable del flujo de trabajo para pagos comerciales en la comunidad Mojaloop.'
      },
      sessions: [
        {
          id: '1033766',
          title:
            'Enabling Banks in Pakistan to offer faster, cost-effective remittance services via ILP'
        }
      ]
    }
  ]
  //get 22 speakers to see pagination
  const speakers2022 = Array.from({ length: 11 }).flatMap(() => baseSpeakers)

  if (articleId) {
    return baseSpeakers.filter((speaker) =>
      speaker.sessions.some((session) => session.id === articleId)
    )
  }

  switch (year) {
    case '2022':
      return speakers2022
    case '2023':
      return Array.from({ length: 2 }).flatMap(() => baseSpeakers)
    case '2024':
      return Array.from({ length: 5 }).flatMap(() => baseSpeakers)
    case '2025':
      return Array.from({ length: 12 }).flatMap(() => baseSpeakers)
    default:
      console.error(
        'Year is not correct or speakers data is not available for that year'
      )
      return []
  }
}
//Dummy function - ignore this for now, will be implemented in a follow up PR
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

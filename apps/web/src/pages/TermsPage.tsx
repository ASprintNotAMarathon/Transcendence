import LegalPage, { LegalSection } from '../components/LegalPage'
import { CONTACT_EMAIL } from '../lib/contact'

const listClass = 'list-disc space-y-2 pl-6'

function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="22 October 2026">
      <LegalSection title="Using Gomoku Friends">
        <p>
          Gomoku Friends is a free student project, made for fun. By creating an account or using the website, you
          agree to these terms. If you do not agree, please do not use it.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <ul className={listClass}>
          <li>Give a real email address, and keep your password to yourself.</li>
          <li>You are responsible for what happens with your account.</li>
          <li>Tell us if you think someone else is using your account.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How to behave">
        <p>Please be kind to other players. It is not allowed to:</p>
        <ul className={listClass}>
          <li>harass, threaten or insult other people, or spam them;</li>
          <li>use a display name, picture or message that is hateful, offensive or illegal;</li>
          <li>cheat, or use bugs to win games;</li>
          <li>try to break, overload or get into parts of the website that are not meant for you, or into other accounts.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          Your name, picture and messages stay yours. By adding them, you allow us to show them to other players on
          the website. Only upload a picture that you are allowed to use.
        </p>
      </LegalSection>

      <LegalSection title="What we may do">
        <p>
          We may remove content or suspend accounts that break these rules. We may also change the website, or stop
          it, at any time.
        </p>
      </LegalSection>

      <LegalSection title="No guarantees">
        <p>
          Gomoku Friends is a student project and is offered as it is. It can have bugs, it can be unavailable, and
          data can be lost. As far as the law allows, we are not responsible for damage caused by using it.
        </p>
      </LegalSection>

      <LegalSection title="Changes and questions">
        <p>
          If we change these terms, we change the date at the top. Questions are welcome at{' '}
          <a className="link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}

export default TermsPage
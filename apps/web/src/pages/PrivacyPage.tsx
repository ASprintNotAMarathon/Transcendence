import LegalPage, { LegalSection } from '../components/LegalPage'
import { CONTACT_EMAIL } from '../lib/contact'

const listClass = 'list-disc space-y-2 pl-6'

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="22 October 2026">
      <LegalSection title="Who we are">
        <p>
          Gomoku Friends is a student project, made for the ft_transcendence project at Codam. It is a website
          where you can play five in a row with friends. This page explains what we keep about you and why.
        </p>
      </LegalSection>

      <LegalSection title="What we store">
        <ul className={listClass}>
          <li>Your email address and display name, which you give us when you sign up.</li>
          <li>
            Your password, but only as a scrambled version (a hash) that cannot be turned back into your
            password. We cannot read it.
          </li>
          <li>Your profile picture, if you upload one.</li>
          <li>The games you play: who played, every move and when, the result and how the game ended.</li>
          <li>One cookie that keeps you logged in.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Why we store it">
        <p>
          We use this only to run the website: to log you in, show your profile, and let you play and chat with
          other players. We do not sell your data, and we do not use advertising or tracking tools.
        </p>
      </LegalSection>

      <LegalSection title="Who can see what">
        <ul className={listClass}>
          <li>Other players can see your display name, your profile picture and your game results.</li>
          <li>Only you can see your email address. We never show it to other players.</li>
          <li>Messages you send in chat go to the person you write to.</li>
          <li>
            A profile picture can be opened by anyone who has its link, even without logging in. The file names
            are random, so links cannot be guessed.
          </li>
          <li>
            Photos can contain hidden information, such as where they were taken. We do not remove it, so please
            choose a picture without sensitive information.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          We use one cookie, to keep you logged in. The website cannot work without it. We do not use cookies for
          advertising or tracking.
        </p>
      </LegalSection>

      <LegalSection title="Other services">
        <p>
          The fonts on this website are loaded from Google Fonts. When you open a page, your browser connects to
          Google, which can see your IP address. Google has its own privacy policy.
        </p>
      </LegalSection>

      <LegalSection title="How we protect your data">
        <p>
          Passwords are stored hashed and salted. What you type into forms is checked in your browser and again
          on our server.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it, and how to change it">
        <p>
          We keep your data for as long as your account exists. You can change your display name and profile
          picture on your profile page. To have your account and its data removed, contact us at{' '}
          <a className="link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Changes and questions">
        <p>
          If we change this page, we change the date at the top. Questions are welcome at{' '}
          <a className="link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}

export default PrivacyPage
import type { Meta, StoryObj } from "@storybook/react-vite";
import "../index.css";
import "../styles/logo.css";
import { PublicFooter, TrustPage, trustPageForPath } from "./TrustPage";

const meta = { title: "Trust experience" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function TrustStory({ path }: { path: "/about" | "/methodology" | "/privacy" }) {
  const page = trustPageForPath(path);
  if (!page) throw new Error(`Missing Trust page for ${path}`);
  return <><TrustPage page={page} /><PublicFooter /></>;
}

export const About: Story = { render: () => <TrustStory path="/about" /> };
export const Methodology: Story = { render: () => <TrustStory path="/methodology" /> };
export const PrivacyCompact: Story = { render: () => <div style={{ width: 360, maxWidth: "100%" }}><TrustStory path="/privacy" /></div> };

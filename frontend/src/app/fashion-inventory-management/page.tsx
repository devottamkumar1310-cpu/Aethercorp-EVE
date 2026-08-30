import type { Metadata } from "next";
import { TOPIC_PAGES } from "@/lib/topicPages";
import TopicPageTemplate, { generateTopicMetadata } from "@/components/marketing/TopicPageTemplate";

const topic = TOPIC_PAGES["fashion-inventory-management"];

export const metadata: Metadata = generateTopicMetadata(topic);

export default function Page() {
  return <TopicPageTemplate topic={topic} />;
}

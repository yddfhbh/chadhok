import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const sayCommand = new SlashCommandBuilder()
  .setName("말하기")
  .setDescription("채널에 일반 봇 메시지로 입력 문장을 게시")
  .addStringOption(option => option.setName("내용").setDescription("전송할 원문")
    .setRequired(true).setMaxLength(2000));

export const peerCommand = new SlashCommandBuilder()
  .setName("봇대화")
  .setDescription("이 채널에서 허용된 AI 봇과의 연속 대화 제어")
  .addStringOption(option => option.setName("모드").setDescription("대화 모드")
    .setRequired(true).addChoices(
      { name: "켜기", value: "on" }, { name: "끄기", value: "off" },
      { name: "상태", value: "status" }
    ));

export const definitions = [sayCommand, peerCommand];

export async function handleCommand(interaction, { peerChat, ownerId }) {
  if (!interaction.isChatInputCommand() ||
      !["말하기", "봇대화"].includes(interaction.commandName)) return false;

  const deny = async (text) => interaction.reply({
    content: text, ephemeral: true, allowedMentions: { parse: [] },
  });
  if (!peerChat.guildId || interaction.guildId !== peerChat.guildId ||
      !interaction.channel?.isTextBased?.() ||
      interaction.channel?.isDMBased?.()) {
    await deny("지정된 테스트 서버의 텍스트 채널에서만 사용할 수 있습니다.");
    return true;
  }

  if (interaction.commandName === "말하기") {
    if (interaction.user?.id !== ownerId) {
      await deny("지정 사용자만 /말하기를 사용할 수 있습니다.");
      return true;
    }
    const content = interaction.options.getString("내용", true);
    if (typeof content !== "string" || !content.length || content.length > 2000) {
      await deny("1~2000자 메시지만 보낼 수 있습니다.");
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    try {
      await interaction.channel.send({ content, allowedMentions: { parse: [] } });
      try { await interaction.deleteReply(); }
      catch { await interaction.editReply({ content: "전송 완료." }); }
    } catch {
      await interaction.editReply({ content: "전송에 실패했습니다. 채널 전송 권한을 확인하세요." });
    }
    return true;
  }

  const allowed = interaction.user?.id === ownerId ||
    Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
  if (!allowed) {
    await deny("이 채널의 봇대화를 관리할 권한이 없습니다.");
    return true;
  }
  await peerChat.load();
  const mode = interaction.options.getString("모드", true);
  if (mode === "status") {
    await deny(`현재 채널 봇대화: ${peerChat.isEnabled(interaction.channelId) ? "ON" : "OFF"}`);
    return true;
  }
  if (!["on", "off"].includes(mode)) {
    await deny("올바르지 않은 모드입니다.");
    return true;
  }
  if (mode === "on" && peerChat.peerIds.size === 0) {
    await deny("PEER_CHAT_BOT_IDS에 상대 봇 ID를 등록해야 합니다.");
    return true;
  }
  try {
    await peerChat.setEnabled(interaction.channelId, mode === "on");
    await interaction.reply({
      content: `이 채널 봇대화: **${mode === "on" ? "ON" : "OFF"}**`,
      ephemeral: false, allowedMentions: { parse: [] },
    });
  } catch {
    await deny("봇대화 설정 저장에 실패했습니다.");
  }
  return true;
}

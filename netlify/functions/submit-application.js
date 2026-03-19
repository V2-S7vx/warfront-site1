exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json"
  };

  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON body" })
      };
    }

    const requiredFields = [
      "rp_name",
      "discord_username",
      "discord_user_id",
      "email",
      "age",
      "found_us",
      "group"
    ];

    for (const field of requiredFields) {
      if (!body[field] || String(body[field]).trim() === "") {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Missing field: ${field}` })
        };
      }
    }

    const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "1483624256909611078";
    const PING_ROLE_ID = "1483595545548423289";

    if (!BOT_TOKEN) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Missing DISCORD_BOT_TOKEN in Netlify environment variables" })
      };
    }

    const userId = String(body.discord_user_id).trim();

    if (!/^\d{17,20}$/.test(userId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "discord_user_id must be a valid Discord user ID" })
      };
    }

    const clean = (value, max = 1000) => {
      if (value === null || value === undefined) return "Not provided";

      const text = String(value).trim();
      if (!text) return "Not provided";

      return text
        .replace(/@everyone/g, "@ everyone")
        .replace(/@here/g, "@ here")
        .replace(/<@&?\d+>/g, "[mention removed]")
        .slice(0, max);
    };

    const embed = {
      title: "New Warfront 1941 Application",
      color: 11831862,
      fields: [
        { name: "RP Name", value: clean(body.rp_name), inline: true },
        { name: "Discord Username & ID", value: clean(body.discord_username), inline: true },
        { name: "Discord User ID", value: clean(body.discord_user_id), inline: true },
        { name: "Age", value: clean(body.age), inline: true },
        { name: "Email", value: clean(body.email), inline: true },
        { name: "Found Us Via", value: clean(body.found_us), inline: true },
        { name: "Group Applying For", value: clean(body.group), inline: true },
        { name: "Steam Profile", value: clean(body.steam_profile), inline: false },
        { name: "Previous Experience", value: clean(body.experience), inline: false },
        { name: "Why Join", value: clean(body.why_join), inline: false },
        { name: "About You", value: clean(body.about_you), inline: false },
        { name: "Community Knowledge", value: clean(body.community_knowledge), inline: false },
        { name: "Availability", value: clean(body.availability), inline: false }
      ],
      footer: {
        text: "Warfront 1941 Website Application"
      },
      timestamp: new Date().toISOString()
    };

    const components = [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            custom_id: `app_accept_${userId}`,
            label: "Accept"
          },
          {
            type: 2,
            style: 4,
            custom_id: `app_decline_${userId}`,
            label: "Decline"
          }
        ]
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            custom_id: `app_us_${userId}`,
            label: "US Faction"
          },
          {
            type: 2,
            style: 2,
            custom_id: `app_germany_${userId}`,
            label: "Germany Faction"
          }
        ]
      }
    ];

    const discordResponse = await fetch(
      `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bot ${BOT_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: `<@&${PING_ROLE_ID}> New application from <@${userId}>`,
          embeds: [embed],
          components,
          allowed_mentions: {
            roles: [PING_ROLE_ID],
            users: [userId]
          }
        })
      }
    );

    const discordText = await discordResponse.text();

    if (!discordResponse.ok) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: `Discord API error: ${discordResponse.status}`,
          details: discordText
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        message: "Application sent to Discord."
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Server error",
        details: error.message
      })
    };
  }
};
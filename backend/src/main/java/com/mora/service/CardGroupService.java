package com.mora.service;

import com.mora.dto.card.CardGroupRequest;
import com.mora.dto.card.CardGroupResponse;
import com.mora.entity.BusinessCardGroup;
import com.mora.repository.BusinessCardGroupRepository;
import com.mora.repository.BusinessCardRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class CardGroupService {

    private static final int MAX_GROUP_NAME_LENGTH = 60;

    private final BusinessCardGroupRepository groupRepository;
    private final BusinessCardRepository cardRepository;

    public CardGroupService(BusinessCardGroupRepository groupRepository,
                            BusinessCardRepository cardRepository) {
        this.groupRepository = groupRepository;
        this.cardRepository = cardRepository;
    }

    public List<CardGroupResponse> list(UUID userId) {
        return groupRepository.findByUserIdOrderByCreatedAtAsc(userId)
                .stream()
                .map(CardGroupResponse::from)
                .toList();
    }

    @Transactional
    public CardGroupResponse create(UUID userId, CardGroupRequest request) {
        String name = normalizeName(request);
        if (groupRepository.existsByUserIdAndName(userId, name)) {
            throw new RuntimeException("이미 존재하는 그룹명입니다.");
        }

        BusinessCardGroup group = new BusinessCardGroup();
        group.setUserId(userId);
        group.setName(name);
        return CardGroupResponse.from(groupRepository.save(group));
    }

    @Transactional
    public CardGroupResponse update(UUID userId, UUID groupId, CardGroupRequest request) {
        BusinessCardGroup group = findOwnedGroup(userId, groupId);
        String name = normalizeName(request);
        if (!group.getName().equals(name) && groupRepository.existsByUserIdAndName(userId, name)) {
            throw new RuntimeException("이미 존재하는 그룹명입니다.");
        }

        group.setName(name);
        return CardGroupResponse.from(groupRepository.save(group));
    }

    @Transactional
    public void delete(UUID userId, UUID groupId) {
        BusinessCardGroup group = findOwnedGroup(userId, groupId);
        groupRepository.delete(group);
    }

    public void validateGroupOwnership(UUID userId, UUID groupId) {
        if (groupId == null) return;
        findOwnedGroup(userId, groupId);
    }

    public long countCards(UUID groupId) {
        return cardRepository.countByGroupId(groupId);
    }

    private BusinessCardGroup findOwnedGroup(UUID userId, UUID groupId) {
        return groupRepository.findByIdAndUserId(groupId, userId)
                .orElseThrow(() -> new RuntimeException("그룹을 찾을 수 없습니다."));
    }

    private String normalizeName(CardGroupRequest request) {
        if (request == null || request.getName() == null) {
            throw new RuntimeException("그룹명을 입력해주세요.");
        }
        String name = request.getName().trim();
        if (name.isBlank()) {
            throw new RuntimeException("그룹명을 입력해주세요.");
        }
        if (name.length() > MAX_GROUP_NAME_LENGTH) {
            throw new RuntimeException("그룹명은 60자 이하로 입력해주세요.");
        }
        return name;
    }
}
